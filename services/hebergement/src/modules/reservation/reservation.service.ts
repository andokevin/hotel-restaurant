import { Conflit, NotFound, RegleMetier } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { anneeMadagascar } from "../../temps.js";
import { listerNuits } from "./tarif.js";
import type { CreerReservationDTO, FiltreReservation } from "./reservation.schema.js";

// Numéro lisible et unique : RES-2026-000042.
// upsert + increment se traduit par un seul ordre SQL (INSERT … ON CONFLICT DO UPDATE),
// exécuté atomiquement par PostgreSQL : deux appels simultanés obtiennent 41 et 42, jamais 42 deux fois.
async function prochaineReference(tx: Prisma.TransactionClient): Promise<string> {
  const annee = anneeMadagascar();
  const compteur = await tx.compteurReservation.upsert({
    where: { annee },
    create: { annee, dernierNumero: 1 },
    update: { dernierNumero: { increment: 1 } },
  });
  return `RES-${annee}-${String(compteur.dernierNumero).padStart(6, "0")}`;
}

export const creerReservation = async (data: CreerReservationDTO) => {
  const chambre = await prisma.chambre.findUnique({
    where: { id: data.chambreId },
    include: { categorie: true },
  });
  if (!chambre) throw NotFound("Chambre");
  if (chambre.horsService) throw RegleMetier("Cette chambre est hors service");

  const nuits = listerNuits(data.dateArrivee, data.dateDepart);
  if (nuits.length === 0) throw RegleMetier("Le séjour doit durer au moins une nuit");

  // Toutes les saisons qui couvrent le séjour, en une requête
  const saisons = await prisma.saison.findMany({
    where: {
      dateDebut: { lte: new Date(data.dateDepart) },
      dateFin: { gte: new Date(data.dateArrivee) },
    },
    include: { tarifs: { where: { categorieId: chambre.categorieId } } },
  });

  const lignesNuitees = nuits.map((nuit) => {
    const saison = saisons.find((s) => nuit >= s.dateDebut && nuit <= s.dateFin);
    const tarifSaison = saison?.tarifs[0]?.tarifNuit;
    return {
      nuit,
      tarifApplique: tarifSaison ?? chambre.categorie.tarifNuit,
      saisonId: saison && tarifSaison !== undefined ? saison.id : null,
    };
  });

  // Le montant est TOUJOURS calculé ici, jamais reçu du client.
  const montantTotal = lignesNuitees.reduce((s, l) => s + l.tarifApplique, 0);

  // Si la chambre est déjà prise, l'INSERT viole la contrainte EXCLUDE,
  // la transaction est annulée (le compteur aussi) et le gestionnaire d'erreurs répond 409.
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        reference: await prochaineReference(tx),
        chambreId: data.chambreId,
        clientNom: data.clientNom,
        clientTelephone: data.clientTelephone,
        clientEmail: data.clientEmail,
        pieceIdentiteType: data.pieceIdentiteType,
        pieceIdentiteNumero: data.pieceIdentiteNumero,
        dateArrivee: new Date(data.dateArrivee),
        dateDepart: new Date(data.dateDepart),
        montantTotal,
        canal: data.canal,
        langue: data.langue,
        expireLe: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await tx.reservationNuitee.createMany({
      data: lignesNuitees.map((l) => ({ ...l, reservationId: reservation.id })),
    });

    return tx.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: { nuitees: true, chambre: { include: { categorie: true } } },
    });
  });
};

export const listerReservations = (filtre: FiltreReservation) =>
  prisma.reservation.findMany({
    where: filtre.statut ? { statut: filtre.statut } : {},
    include: { chambre: true },
    orderBy: { createdAt: "desc" },
  });

export const trouverReservation = async (id: string) => {
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { nuitees: { orderBy: { nuit: "asc" } }, chambre: { include: { categorie: true } } },
  });
  if (!r) throw NotFound("Réservation");
  return r;
};

// Appelée uniquement par facturation, après un paiement vérifié (route /interne).
export const confirmerReservation = async (id: string) => {
  const r = await trouverReservation(id);

  if (r.statut === "CONFIRMEE") return r; // idempotent : 2e appel sans effet
  if (r.statut !== "EN_ATTENTE_PAIEMENT") {
    throw RegleMetier(`Impossible de confirmer une réservation ${r.statut}`);
  }

  // Verrouillage optimiste : on ne modifie que si personne n'a touché la ligne
  // depuis notre lecture (même version, toujours en attente).
  // updateMany ne lève pas d'erreur si rien ne correspond : il renvoie count = 0.
  const { count } = await prisma.reservation.updateMany({
    where: { id, version: r.version, statut: "EN_ATTENTE_PAIEMENT" },
    data: { statut: "CONFIRMEE", expireLe: null, version: { increment: 1 } },
  });
  if (count === 0) throw Conflit("La réservation a été modifiée entre-temps, réessayez");

  return trouverReservation(id);
};
