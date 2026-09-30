import { prisma } from "../../db.js";
import { NotFound, RegleMetier } from "../../errors.js";
import { listerNuits } from "./tarif.js";
import type { CreerReservationDTO } from "./reservation.schema.js";

const genererReference = () =>
  `RES-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

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
      saisonId: tarifSaison ? saison!.id : null,
    };
  });

  const montantTotal = lignesNuitees.reduce((s, l) => s + l.tarifApplique, 0);

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        reference: genererReference(),
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

export const listerReservations = (statut?: string) =>
  prisma.reservation.findMany({
    where: statut ? { statut: statut as never } : {},
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

export const confirmerReservation = async (id: string) => {
  const r = await trouverReservation(id);

  if (r.statut === "CONFIRMEE") return r;               // idempotent : 2e appel sans effet
  if (r.statut !== "EN_ATTENTE_PAIEMENT") {
    throw RegleMetier(`Impossible de confirmer une réservation ${r.statut}`);
  }

  return prisma.reservation.update({
    where: { id, version: r.version },                   // verrouillage optimiste
    data: { statut: "CONFIRMEE", expireLe: null, version: { increment: 1 } },
  });
};