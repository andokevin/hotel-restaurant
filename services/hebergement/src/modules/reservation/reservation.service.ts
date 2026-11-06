import { z } from "zod";
import {
  anneeMadagascar,
  AppError,
  aujourdhuiMadagascar,
  Conflit,
  enTexte,
  lireErreurBase,
  NotFound,
  RegleMetier,
  type Enveloppe,
  type Identite,
} from "@hotel/commun";
import { prisma } from "../../db.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { ecrireEvenement, traiterUneFois } from "../../outbox.js";
import { annulerExpiration, DELAI_PAIEMENT_MS, planifierExpiration } from "./expiration.js";
import { listerNuits } from "./tarif.js";
import { verifierTransition } from "./transitions.js";
import type { CheckInDTO, CreerReservationDTO, FiltreReservation } from "./reservation.schema.js";

// Statuts qui occupent une chambre (les mêmes que dans la contrainte EXCLUDE)
const ACTIFS = ["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS"] as const;
const ROUTE_CREATION = "POST /reservations";

const DETAIL = {
  nuitees: { orderBy: { nuit: "asc" }, include: { saison:{select: { nom: true }} } },
  chambre: { include: { categorie: true } },
 
} satisfies Prisma.ReservationInclude;

const AucuneChambre = () =>
  new AppError(409, "AUCUNE_CHAMBRE_DISPONIBLE", "Aucune chambre de cette catégorie n'est libre sur ces dates");

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export const trouverReservation = async (id: string) => {
  const r = await prisma.reservation.findUnique({ where: { id }, include: DETAIL });
  if (!r) throw NotFound("Réservation");
  return r;
};

// Un CLIENT ne voit que SES réservations. Pour une réservation d'un autre, on répond 404
// (et non 403) : on ne confirme même pas qu'elle existe.
export const trouverReservationPour = async (id: string, identite: Identite) => {
  const r = await trouverReservation(id);
  if (identite.role === "CLIENT" && r.clientId !== identite.id) throw NotFound("Réservation");
  return r;
};

export const listerReservations = (filtre: FiltreReservation) =>
  prisma.reservation.findMany({
    where: filtre.statut ? { statut: filtre.statut } : {},
    include: { chambre: true },
    orderBy: { createdAt: "desc" },
  });

export const listerMesReservations = (clientId: string) =>
  prisma.reservation.findMany({ where: { clientId }, include: DETAIL, orderBy: { dateArrivee: "desc" } });

// Minuteur BPMN « Date de départ atteinte » : les séjours en cours dont le départ est aujourd'hui (ou dépassé).
export const listerDeparts = () =>
  prisma.reservation.findMany({
    where: { statut: "EN_COURS", dateDepart: { lte: new Date(aujourdhuiMadagascar()) } },
    include: { chambre: true },
    orderBy: { dateDepart: "asc" },
  });

// Pour le restaurant (appel interne) : « qui occupe la chambre 204 en ce moment ? »
export const reservationEnCours = async (chambreNumero: string) => {
  const r = await prisma.reservation.findFirst({
    where: { statut: "EN_COURS", chambre: { numero: chambreNumero } },
    select: { id: true, reference: true, clientNom: true, dateDepart: true, chambre: { select: { id: true, numero: true } } },
  });
  if (!r) throw NotFound(`Séjour en cours dans la chambre ${chambreNumero}`);
  return r;
};

// Pour la comptabilité (appel interne, contrôle de 23 h) : nuitées vendues une nuit donnée
// (réservations payées : confirmées, en cours ou terminées) et répartition par canal de vente.
export async function statistiquesDuJour(jour: string) {
  const vendues = { reservation: { statut: { in: ["CONFIRMEE" as const, "EN_COURS" as const, "TERMINEE" as const] } } };
  const nuitees = await prisma.reservationNuitee.findMany({
    where: { nuit: new Date(jour), ...vendues },
    select: { reservation: { select: { canal: true } } },
  });
  const repartitionCanaux: Record<string, number> = {};
  for (const n of nuitees) repartitionCanaux[n.reservation.canal] = (repartitionCanaux[n.reservation.canal] ?? 0) + 1;
  return { jour, nuiteesVendues: nuitees.length, repartitionCanaux };
}

// ---------------------------------------------------------------------------
// Création : le serveur choisit la chambre
// ---------------------------------------------------------------------------

async function prochaineReference(tx: Prisma.TransactionClient): Promise<string> {
  const annee = anneeMadagascar();
  const compteur = await tx.compteurReservation.upsert({
    where: { annee },
    create: { annee, dernierNumero: 1 },
    update: { dernierNumero: { increment: 1 } },
  });
  return `RES-${annee}-${String(compteur.dernierNumero).padStart(6, "0")}`;
}

// Une ligne par nuit, au tarif de la saison si elle en a un, sinon au tarif de base.
async function calculerNuitees(categorie: { id: string; tarifNuit: number }, arrivee: string, depart: string) {
  const nuits = listerNuits(arrivee, depart);
  const saisons = await prisma.saison.findMany({
    where: { dateDebut: { lte: new Date(depart) }, dateFin: { gte: new Date(arrivee) } },
    include: { tarifs: { where: { categorieId: categorie.id } } },
  });
  return nuits.map((nuit) => {
    const saison = saisons.find((s) => nuit >= s.dateDebut && nuit <= s.dateFin);
    const tarifSaison = saison?.tarifs[0]?.tarifNuit;
    return {
      nuit,
      tarifApplique: tarifSaison ?? categorie.tarifNuit,
      saisonId: saison && tarifSaison !== undefined ? saison.id : null,
    };
  });
}

// Même Idempotency-Key déjà vue : on renvoie la réservation créée la première fois.
async function relireIdempotence(cle: string, identite: Identite) {
  const ligne = await prisma.cleIdempotence.findUnique({ where: { cle } });
  if (!ligne) return null;
  if (ligne.route !== ROUTE_CREATION || ligne.utilisateurId !== identite.id) {
    throw new AppError(422, "CLE_IDEMPOTENCE_REUTILISEE", "Cette Idempotency-Key a déjà servi pour une autre requête");
  }
  const { reservationId } = z.object({ reservationId: z.uuid() }).parse(ligne.reponse);
  return trouverReservation(reservationId);
}

export async function creerReservation(data: CreerReservationDTO, identite: Identite, cle?: string) {
  if (cle) {
    const deja = await relireIdempotence(cle, identite);
    if (deja) return { reservation: deja, rejouee: true };
  }

  const categorie = await prisma.categorieChambre.findUnique({ where: { id: data.categorieId } });
  if (!categorie) throw NotFound("Catégorie");

  // Vérifiée AVANT de chercher une chambre : inutile de parcourir les chambres pour rien.
  const personnes = data.nbAdultes + data.nbEnfants;
  if (personnes > categorie.capacite) {
    throw RegleMetier(`Cette catégorie accueille ${categorie.capacite} personnes au maximum (demande : ${personnes} personnes)`);
  }

  const nuitees = await calculerNuitees(categorie, data.dateArrivee, data.dateDepart);
  // Le montant est TOUJOURS calculé ici, jamais reçu du client.
  const montantTotal = nuitees.reduce((s, n) => s + n.tarifApplique, 0);
  const estClient = identite.role === "CLIENT";
  const arrivee = new Date(data.dateArrivee);
  const depart = new Date(data.dateDepart);

  // 1. Candidates : chambres de la catégorie, en service, sans réservation active qui chevauche.
  //    Cette lecture n'est qu'une INDICATION : entre elle et l'INSERT, une autre requête peut
  //    prendre la même chambre. La garantie vient de l'étape 2.
  const candidates = await prisma.chambre.findMany({
    where: {
      categorieId: categorie.id,
      horsService: false,
      reservations: { none: { statut: { in: [...ACTIFS] }, dateArrivee: { lt: depart }, dateDepart: { gt: arrivee } } },
    },
    orderBy: { numero: "asc" },
    select: { id: true, numero: true },
  });

  // 2. On essaie chaque candidate dans SA PROPRE transaction. Si une autre requête l'a prise
  //    entre-temps, PostgreSQL refuse l'INSERT (contrainte EXCLUDE) : on passe à la suivante.
  //    Une seule transaction pour toutes les tentatives serait impossible : après une erreur,
  //    PostgreSQL refuse toute nouvelle commande dans la transaction en cours.
  for (const chambre of candidates) {
    try {
      const reservation = await prisma.$transaction(async (tx) => {
        const expireLe = new Date(Date.now() + DELAI_PAIEMENT_MS);
        const r = await tx.reservation.create({
          data: {
            reference: await prochaineReference(tx),
            chambreId: chambre.id,
            clientId: estClient ? identite.id : null,
            clientNom: data.clientNom,
            clientTelephone: data.clientTelephone,
            clientEmail: data.clientEmail,
            pieceIdentiteType: data.pieceIdentiteType,
            pieceIdentiteNumero: data.pieceIdentiteNumero,
            dateArrivee: arrivee,
            dateDepart: depart,
            nbAdultes: data.nbAdultes,
            nbEnfants: data.nbEnfants,
            montantTotal,
            canal: estClient ? "SITE_WEB" : data.canal,
            langue: data.langue,
            expireLe,
          },
        });
        await tx.reservationNuitee.createMany({ data: nuitees.map((n) => ({ ...n, reservationId: r.id })) });

        // Même transaction : l'événement existe si et seulement si la réservation existe.
        await ecrireEvenement(tx, "reservation.creee", {
          reservationId: r.id,
          reference: r.reference,
          clientId: r.clientId,
          clientNom: r.clientNom,
          clientTelephone: r.clientTelephone,
          clientEmail: r.clientEmail,
          langue: r.langue,
          categorieCode: categorie.code,
          chambreNumero: chambre.numero,
          dateArrivee: data.dateArrivee,
          dateDepart: data.dateDepart,
          nbNuits: nuitees.length,
          nbAdultes: r.nbAdultes,
          nbEnfants: r.nbEnfants,
          montantTotal,
          expireLe: expireLe.toISOString(),
        });

        if (cle) {
          await tx.cleIdempotence.create({
            data: { cle, route: ROUTE_CREATION, utilisateurId: identite.id, reponse: { reservationId: r.id } },
          });
        }
        return { id: r.id, expireLe };
      });

      // APRÈS le commit : appel réseau (Redis) hors de toute transaction.
      await planifierExpiration(reservation.id, reservation.expireLe);
      return { reservation: await trouverReservation(reservation.id), rejouee: false };
    } catch (err) {
      const contrainte = lireErreurBase(err)?.contrainte;
      // Chambre prise entre la lecture et l'écriture : on essaie la suivante.
      if (contrainte === "reservation_sans_chevauchement") continue;
      // Même Idempotency-Key envoyée deux fois en même temps : l'autre requête a gagné.
      if (contrainte === "cle_idempotence_pkey" && cle) {
        const deja = await relireIdempotence(cle, identite);
        if (deja) return { reservation: deja, rejouee: true };
      }
      throw err;
    }
  }

  throw AucuneChambre();
}

// ---------------------------------------------------------------------------
// Changements d'état
// ---------------------------------------------------------------------------

async function confirmerDansTransaction(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const r = await tx.reservation.findUnique({ where: { id } });
  if (!r) throw NotFound("Réservation");
  // Déjà confirmée, en cours ou terminée : rien à faire. C'est le cas d'un paiement de SOLDE
  // (consommations restaurant réglées pendant ou après le séjour), pas d'une anomalie.
  if (r.statut === "CONFIRMEE" || r.statut === "EN_COURS" || r.statut === "TERMINEE") return;
  verifierTransition(r.statut, "CONFIRMEE"); // reste : ANNULEE → refus (paiement arrivé trop tard)

  // Verrouillage optimiste : si le job d'expiration l'a annulée entre notre lecture et
  // cette écriture, la condition ne correspond plus et count vaut 0.
  const { count } = await tx.reservation.updateMany({
    where: { id, version: r.version, statut: "EN_ATTENTE_PAIEMENT" },
    data: { statut: "CONFIRMEE", expireLe: null, version: { increment: 1 } },
  });
  if (count === 0) throw Conflit("La réservation a été modifiée entre-temps, réessayez");

  await ecrireEvenement(tx, "reservation.confirmee", {
    reservationId: r.id,
    reference: r.reference,
    clientId: r.clientId,
    clientNom: r.clientNom,
    clientTelephone: r.clientTelephone,
    clientEmail: r.clientEmail,
    langue: r.langue,
  });
}

// Route interne (appelée par facturation jusqu'à la phase 4)
export async function confirmerReservation(id: string) {
  await prisma.$transaction((tx) => confirmerDansTransaction(tx, id));
  await annulerExpiration(id); // après le commit
  return trouverReservation(id);
}

// Consommateur de l'événement paiement.recu (publié par facturation)
export async function traiterPaiementRecu(evt: Enveloppe<"paiement.recu">): Promise<void> {
  const reservationId = evt.payload.reservationId;
  if (!reservationId) return; // paiement d'une commande restaurant : ne concerne pas hebergement

  const resultat = await traiterUneFois(evt.id, async (tx) => {
    try {
      await confirmerDansTransaction(tx, reservationId);
    } catch (err) {
      // Réservation annulée (expirée) ou introuvable : réessayer ne changera rien.
      // L'argent est pourtant encaissé : on le signale fort, pour un remboursement.
      if (err instanceof AppError && (err.statusCode === 422 || err.statusCode === 404)) {
        logger.error({ reservationId, paiementId: evt.payload.paiementId, raison: err.message },
          "paiement reçu pour une réservation non confirmable : remboursement à prévoir");
        return;
      }
      throw err; // erreur passagère (base, conflit de version) : BullMQ réessaiera
    }
  });
  if (resultat === "traite") await annulerExpiration(reservationId);
}

export async function annulerReservation(id: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id } });
    if (!r) throw NotFound("Réservation");
    verifierTransition(r.statut, "ANNULEE");
    const { count } = await tx.reservation.updateMany({
      where: { id, version: r.version, statut: r.statut },
      data: { statut: "ANNULEE", expireLe: null, version: { increment: 1 } },
    });
    if (count === 0) throw Conflit("La réservation a été modifiée entre-temps, réessayez");
  });
  await annulerExpiration(id);
  return trouverReservation(id);
}

export async function faireCheckIn(id: string, data: CheckInDTO) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id }, include: { chambre: true } });
    if (!r) throw NotFound("Réservation");
    verifierTransition(r.statut, "EN_COURS");

    const aujourdhui = aujourdhuiMadagascar();
    if (aujourdhui < enTexte(r.dateArrivee)) throw RegleMetier(`Check-in possible à partir du ${enTexte(r.dateArrivee)}`);
    if (aujourdhui >= enTexte(r.dateDepart)) throw RegleMetier("La date de départ est déjà atteinte");

    const chambreId = data.chambreId ?? r.chambreId;
    const cible = await tx.chambre.findUnique({ where: { id: chambreId } });
    if (!cible) throw NotFound("Chambre");
    if (cible.categorieId !== r.chambre.categorieId) {
      throw RegleMetier("La chambre attribuée doit être de la même catégorie que la réservation");
    }

    // Règle du sujet : seules les chambres propres sont attribuées au check-in.
    // Vérifier ET verrouiller en une seule écriture : la ligne de la chambre reste verrouillée
    // jusqu'au commit, personne ne peut la passer à SALE entre la vérification et le check-in.
    const { count: chambreOk } = await tx.chambre.updateMany({
      where: { id: chambreId, etatMenage: "PROPRE", horsService: false },
      data: { version: { increment: 1 } },
    });
    if (chambreOk === 0) {
      throw RegleMetier(`La chambre ${cible.numero} n'est pas propre ou est hors service : attribuez une chambre PROPRE de la même catégorie`);
    }

    // Si la nouvelle chambre est réservée par quelqu'un d'autre sur ces dates,
    // la contrainte EXCLUDE refuse cette mise à jour (409 CHAMBRE_INDISPONIBLE).
    const { count } = await tx.reservation.updateMany({
      where: { id, version: r.version, statut: "CONFIRMEE" },
      data: { statut: "EN_COURS", chambreId, checkInLe: new Date(), version: { increment: 1 } },
    });
    if (count === 0) throw Conflit("La réservation a été modifiée entre-temps, réessayez");

    await ecrireEvenement(tx, "sejour.commence", {
      reservationId: r.id,
      chambreId,
      chambreNumero: cible.numero,
      dateArrivee: enTexte(r.dateArrivee),
      dateDepart: enTexte(r.dateDepart),
    });
  });
  return trouverReservation(id);
}

export async function faireCheckOut(id: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({
      where: { id },
      include: { chambre: true, _count: { select: { nuitees: true } } },
    });
    if (!r) throw NotFound("Réservation");
    verifierTransition(r.statut, "TERMINEE");

    const checkOutLe = new Date();
    const { count } = await tx.reservation.updateMany({
      where: { id, version: r.version, statut: "EN_COURS" },
      data: { statut: "TERMINEE", checkOutLe, version: { increment: 1 } },
    });
    if (count === 0) throw Conflit("La réservation a été modifiée entre-temps, réessayez");

    // La chambre doit être nettoyée avant le prochain client
    await tx.chambre.update({ where: { id: r.chambreId }, data: { etatMenage: "SALE", version: { increment: 1 } } });

    await ecrireEvenement(tx, "sejour.termine", {
      reservationId: r.id,
      chambreId: r.chambreId,
      chambreNumero: r.chambre.numero,
      dateArrivee: enTexte(r.dateArrivee),
      dateDepart: enTexte(r.dateDepart),
      nbNuits: r._count.nuitees,
      checkOutLe: checkOutLe.toISOString(),
    });
  });
  return trouverReservation(id);
}
