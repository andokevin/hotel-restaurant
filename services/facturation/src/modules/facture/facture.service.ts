import { AppError, lireErreurBase, NotFound, RegleMetier, type Enveloppe, type Identite } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { lireReservation } from "../../hebergement.js";
import { logger } from "../../logger.js";
import { prochainNumero } from "../../numero.js";
import { ecrireEvenement, traiterUneFois } from "../../outbox.js";

// Ce qu'on montre d'un paiement : JAMAIS les empreintes des jetons.
export const CHAMPS_PAIEMENT = {
  id: true,
  montant: true,
  statut: true,
  methode: true,
  referenceExterne: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaiementSelect;

const DETAIL = {
  lignes: true,
  paiements: { select: CHAMPS_PAIEMENT, orderBy: { createdAt: "asc" } },
} satisfies Prisma.FactureInclude;

// Ce dont on a besoin pour émettre la facture d'un séjour (snapshot, jamais relu ensuite)
export type SnapshotSejour = {
  reservationId: string;
  reference: string;
  clientId: string | null;
  clientNom: string;
  clientEmail: string;
  clientTelephone: string;
  langue: "FR" | "MG" | "EN";
  categorieCode: string;
  chambreNumero: string;
  dateArrivee: string;
  dateDepart: string;
  nbNuits: number;
  montantTotal: number;
};

// « Suite Senior – 3 nuits » : si les nuits n'ont pas toutes le même tarif (saisons),
// on facture 1 × le total pour que quantité × prix = montant reste exact.
function ligneSejour(s: SnapshotSejour) {
  const parNuit = s.montantTotal / s.nbNuits;
  const regulier = Number.isInteger(parNuit);
  return {
    libelle: `${s.categorieCode} – ${s.nbNuits} nuit(s) du ${s.dateArrivee} au ${s.dateDepart}, chambre ${s.chambreNumero} (${s.reference})`,
    quantite: regulier ? s.nbNuits : 1,
    prixUnitaire: regulier ? parNuit : s.montantTotal,
    montant: s.montantTotal,
    origine: "HEBERGEMENT" as const,
    sourceId: s.reservationId,
  };
}

// ---------------------------------------------------------------------------
// Émission (tâche BPMN « Émettre la facture »)
// ---------------------------------------------------------------------------

// Idempotent : une réservation n'a qu'une facture (reservation_id est unique).
async function emettreDansTransaction(tx: Prisma.TransactionClient, s: SnapshotSejour) {
  const existante = await tx.facture.findUnique({ where: { reservationId: s.reservationId } });
  if (existante) return existante;
  return tx.facture.create({
    data: {
      numero: await prochainNumero(tx), // même transaction : pas de trou dans la numérotation
      type: "SEJOUR",
      reservationId: s.reservationId,
      clientId: s.clientId,
      clientNom: s.clientNom,
      clientEmail: s.clientEmail,
      clientTelephone: s.clientTelephone,
      langue: s.langue,
      montantTotal: s.montantTotal,
      lignes: { create: [ligneSejour(s)] },
    },
  });
}

// Consommateur de reservation.creee (docs/modele-donnees.md : « Émettre la facture »)
export async function traiterReservationCreee(evt: Enveloppe<"reservation.creee">): Promise<void> {
  await traiterUneFois(evt.id, async (tx) => {
    await emettreDansTransaction(tx, evt.payload);
  });
}

// La facture d'une réservation, même si l'événement n'est pas encore arrivé (délai du relais) :
// on relit alors la réservation en REST et on l'émet nous-mêmes. Les deux chemins sont
// idempotents : si l'événement arrive ensuite, il retrouve la facture existante.
export async function obtenirFactureSejour(reservationId: string) {
  const existante = await prisma.facture.findUnique({ where: { reservationId } });
  if (existante) return existante;

  const r = await lireReservation(reservationId);
  const snapshot: SnapshotSejour = {
    reservationId: r.id,
    reference: r.reference,
    clientId: r.clientId,
    clientNom: r.clientNom,
    clientEmail: r.clientEmail,
    clientTelephone: r.clientTelephone,
    langue: r.langue,
    categorieCode: r.chambre.categorie.code,
    chambreNumero: r.chambre.numero,
    dateArrivee: r.dateArrivee.slice(0, 10),
    dateDepart: r.dateDepart.slice(0, 10),
    nbNuits: r.nuitees.length,
    montantTotal: r.montantTotal,
  };
  try {
    return await prisma.$transaction((tx) => emettreDansTransaction(tx, snapshot));
  } catch (err) {
    // L'événement a créé la facture au même instant : on relit la sienne.
    if (lireErreurBase(err)?.contrainte === "facture_reservation_id_key") {
      return prisma.facture.findUniqueOrThrow({ where: { reservationId } });
    }
    throw err;
  }
}

// Facture d'une commande réglée au restaurant (appel interne du service restaurant, qui fournit
// ses propres prix). Idempotent : une commande n'a qu'une facture (commande_id unique).
export type DemandeFactureRestaurant = {
  commandeId: string;
  reference: string;
  clientNom: string;
  lignes: { libelle: string; quantite: number; prixUnitaire: number }[];
};

export async function creerFactureRestaurant(d: DemandeFactureRestaurant) {
  const existante = await prisma.facture.findUnique({ where: { commandeId: d.commandeId } });
  if (existante) return existante;
  const montant = d.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  try {
    return await prisma.$transaction(async (tx) =>
      tx.facture.create({
        data: {
          numero: await prochainNumero(tx),
          type: "RESTAURANT",
          commandeId: d.commandeId,
          clientNom: d.clientNom,
          montantTotal: montant,
          // Une seule ligne par commande (UNIQUE origine + source_id) ; le détail reste dans le restaurant
          lignes: {
            create: [
              {
                libelle: `Restaurant ${d.reference} : ${d.lignes.map((l) => `${l.libelle} ×${l.quantite}`).join(", ")}`.slice(0, 500),
                quantite: 1,
                prixUnitaire: montant,
                montant,
                origine: "RESTAURANT",
                sourceId: d.commandeId,
              },
            ],
          },
        },
      }),
    );
  } catch (err) {
    if (lireErreurBase(err)?.contrainte === "facture_commande_id_key") {
      return prisma.facture.findUniqueOrThrow({ where: { commandeId: d.commandeId } });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export const trouverFacture = async (id: string) => {
  const f = await prisma.facture.findUnique({ where: { id }, include: DETAIL });
  if (!f) throw NotFound("Facture");
  return f;
};

// Un CLIENT ne voit que SES factures ; pour celle d'un autre : 404 (on ne confirme pas qu'elle existe).
export const trouverFacturePour = async (id: string, identite: Identite) => {
  const f = await trouverFacture(id);
  if (identite.role === "CLIENT" && f.clientId !== identite.id) throw NotFound("Facture");
  return f;
};

export const listerFactures = (filtre: { reservationId?: string | undefined; statut?: Prisma.FactureWhereInput["statut"] }) =>
  prisma.facture.findMany({
    where: {
      ...(filtre.reservationId ? { reservationId: filtre.reservationId } : {}),
      ...(filtre.statut ? { statut: filtre.statut } : {}),
    },
    include: DETAIL,
    orderBy: { emiseLe: "desc" },
  });

export const listerMesFactures = (clientId: string) =>
  prisma.facture.findMany({ where: { clientId }, include: DETAIL, orderBy: { emiseLe: "desc" } });

// ---------------------------------------------------------------------------
// Encaissement
// ---------------------------------------------------------------------------

// Ajoute un paiement réussi à la facture. Appelé DANS une transaction (espèces ou notification Papi).
// Le surpaiement est refusé par la BASE : CHECK (montant_paye <= montant_total).
// Si le paiement dépasse le reste à payer, l'UPDATE échoue (contrainte facture_pas_de_surpaiement).
export async function appliquerPaiement(tx: Prisma.TransactionClient, factureId: string, paiementId: string, montant: number) {
  const f = await tx.facture.update({ where: { id: factureId }, data: { montantPaye: { increment: montant } } });
  if (f.montantPaye === f.montantTotal) {
    await tx.facture.update({ where: { id: factureId }, data: { statut: "PAYEE" } });
    // Un repas payé est terminé : la facture restaurant est clôturée (et copiée au comptable) aussitôt.
    // Une facture de séjour, elle, attend le départ (des consommations peuvent encore s'ajouter).
    if (f.type === "RESTAURANT") await cloturerDansTransaction(tx, factureId);
  }
  await ecrireEvenement(tx, "paiement.recu", {
    paiementId,
    factureId,
    reservationId: f.reservationId,
    commandeId: f.commandeId,
    montant,
  });
}

// Tâche BPMN « Encaisser le montant » (réception) / « Encaisser au restaurant » : paiement en espèces.
export async function encaisserEspeces(factureId: string, montant: number, identite: Identite) {
  await prisma.$transaction(async (tx) => {
    const f = await tx.facture.findUnique({ where: { id: factureId } });
    if (!f) throw NotFound("Facture");
    if (f.statut === "PAYEE") throw new AppError(409, "FACTURE_DEJA_PAYEE", "Cette facture est déjà soldée");
    if (f.statut !== "EMISE") throw RegleMetier(`Impossible d'encaisser une facture ${f.statut}`);

    const p = await tx.paiement.create({
      data: { factureId, montant, statut: "REUSSI", methode: "ESPECES", encaissePar: identite.id },
    });
    await appliquerPaiement(tx, factureId, p.id, montant);
  });
  return trouverFacture(factureId);
}

// ---------------------------------------------------------------------------
// Clôture (tâches BPMN « Clôturer la facture du séjour » + « Transmettre une copie au comptable »)
// ---------------------------------------------------------------------------

async function cloturerDansTransaction(tx: Prisma.TransactionClient, factureId: string) {
  const clotureeLe = new Date();
  // Condition dans l'écriture : seule une facture entièrement PAYÉE peut être clôturée.
  const { count } = await tx.facture.updateMany({
    where: { id: factureId, statut: "PAYEE" },
    data: { statut: "CLOTUREE", clotureeLe },
  });
  if (count === 0) throw RegleMetier("Seule une facture entièrement payée peut être clôturée");

  const f = await tx.facture.findUniqueOrThrow({ where: { id: factureId }, include: { lignes: true } });
  // La copie pour le comptable : un snapshot complet, avec l'origine de chaque somme.
  await ecrireEvenement(tx, "facture.cloturee", {
    factureId: f.id,
    numero: f.numero,
    type: f.type,
    reservationId: f.reservationId,
    commandeId: f.commandeId,
    clientNom: f.clientNom,
    montantTotal: f.montantTotal,
    montantPaye: f.montantPaye,
    emiseLe: f.emiseLe.toISOString(),
    clotureeLe: clotureeLe.toISOString(),
    lignes: f.lignes.map((l) => ({
      libelle: l.libelle,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      montant: l.montant,
      origine: l.origine,
    })),
  });
}

export async function cloturerFacture(factureId: string) {
  await trouverFacture(factureId);
  await prisma.$transaction((tx) => cloturerDansTransaction(tx, factureId));
  return trouverFacture(factureId);
}

// Consommateur de sejour.termine : si le séjour est soldé, la facture est clôturée tout de suite.
// Sinon (consommations restaurant ajoutées), la réceptionniste encaisse le reste puis clôture.
export async function traiterSejourTermine(evt: Enveloppe<"sejour.termine">): Promise<void> {
  await traiterUneFois(evt.id, async (tx) => {
    const f = await tx.facture.findUnique({ where: { reservationId: evt.payload.reservationId } });
    if (!f) {
      logger.warn({ reservationId: evt.payload.reservationId }, "séjour terminé sans facture");
      return;
    }
    if (f.statut === "PAYEE") {
      await cloturerDansTransaction(tx, f.id);
      return;
    }
    logger.info({ factureId: f.id, reste: f.montantTotal - f.montantPaye }, "séjour terminé : reste à encaisser avant clôture");
  });
}

// ---------------------------------------------------------------------------
// Consommations restaurant (tâche BPMN « Ajouter les consommations restaurant à la facture »)
// ---------------------------------------------------------------------------

// Consommateur de consommation.imputee : la somme est payée à l'hôtel, mais elle APPARTIENT
// au restaurant (origine = RESTAURANT) ; la comptabilité la lui reversera.
export async function traiterConsommationImputee(evt: Enveloppe<"consommation.imputee">): Promise<void> {
  const c = evt.payload;
  // Le montant est recalculé à partir des lignes, jamais repris tel quel
  const montant = c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  if (montant !== c.montant) logger.warn({ commandeId: c.commandeId, annonce: c.montant, calcule: montant }, "montant de consommation recalculé");

  await traiterUneFois(evt.id, async (tx) => {
    const f = await tx.facture.findUnique({ where: { reservationId: c.reservationId } });
    // Facture pas encore émise (événements arrivés dans le désordre) : BullMQ réessaiera.
    if (!f) throw new Error(`Facture du séjour ${c.reservationId} pas encore émise`);
    if (f.statut === "CLOTUREE" || f.statut === "ANNULEE") {
      logger.error({ factureId: f.id, commandeId: c.commandeId }, "consommation reçue après la clôture : à régler au restaurant");
      return;
    }
    const deja = await tx.ligneFacture.findUnique({
      where: { origine_sourceId: { origine: "RESTAURANT", sourceId: c.commandeId } },
    });
    if (deja) return; // même commande imputée deux fois : sans effet

    await tx.ligneFacture.create({
      data: {
        factureId: f.id,
        libelle: `Restaurant – commande ${c.reference} (${c.lignes.length} article(s))`,
        quantite: 1,
        prixUnitaire: montant,
        montant,
        origine: "RESTAURANT",
        sourceId: c.commandeId,
      },
    });
    // Le total augmente : une facture PAYÉE redevient EMISE (il reste la consommation à payer).
    await tx.facture.update({
      where: { id: f.id },
      data: { montantTotal: { increment: montant }, ...(f.statut === "PAYEE" ? { statut: "EMISE" } : {}) },
    });
  });
}
