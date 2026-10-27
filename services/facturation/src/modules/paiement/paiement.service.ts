import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  correspondAEmpreinte,
  empreinteSha256,
  lireErreurBase,
  NonAutorise,
  NotFound,
  RegleMetier,
  UnrecoverableError,
  type Identite,
} from "@hotel/commun";
import { bus } from "../../bus.js";
import { env } from "../../config/env.js";
import { prisma } from "../../db.js";
import type { StatutPaiement } from "../../generated/prisma/client.js";
import { lireReservation } from "../../hebergement.js";
import { logger } from "../../logger.js";
import { creerLienPaiement, lireMethode, lireStatut, MONTANT_MINIMUM, notificationSchema, type NotificationPapi } from "../../papi.js";
import { appliquerPaiement, CHAMPS_PAIEMENT, obtenirFactureSejour, trouverFacture } from "../facture/facture.service.js";
import type { DemandePaiementDTO } from "./paiement.schema.js";

export const FILE_NOTIFICATIONS = "facturation.notifications-papi";

// ---------------------------------------------------------------------------
// 1. Le client demande à payer
// ---------------------------------------------------------------------------

type LienPaiement = { paiementId: string; url: string; montant: number };

// Un lien Papi ne sert qu'à UNE transaction. On ne le renvoie que s'il est tout récent (double clic,
// bouton « Précédent ») ; au-delà, le client est peut-être déjà passé sur Papi et le lien peut être
// consommé : on en crée un nouveau. Si l'ancien est payé malgré tout, le worker le classe en ANOMALIE.
// createdAt et non updatedAt : updatedAt change à chaque modification de la ligne.
const REUTILISATION_LIEN_MS = 30_000;

export async function demanderPaiement(demande: DemandePaiementDTO, identite: Identite): Promise<LienPaiement> {
  const facture =
    "reservationId" in demande ? await obtenirFactureSejour(demande.reservationId) : await trouverFacture(demande.factureId);

  if (identite.role === "CLIENT" && facture.clientId !== identite.id) throw NotFound("Facture");
  if (facture.statut === "PAYEE" || facture.statut === "CLOTUREE") {
    throw new AppError(409, "FACTURE_DEJA_PAYEE", "Cette facture est déjà soldée");
  }
  if (facture.statut === "ANNULEE") throw RegleMetier("Cette facture est annulée");

  // Réservation expirée entre-temps ? On le vérifie AVANT de créer un lien, pour ne pas
  // encaisser le prix d'une chambre qui n'est plus retenue.
  if (facture.reservationId) {
    const r = await lireReservation(facture.reservationId);
    if (r.statut === "ANNULEE") {
      await prisma.facture.updateMany({ where: { id: facture.id, statut: "EMISE", montantPaye: 0 }, data: { statut: "ANNULEE" } });
      throw new AppError(422, "RESERVATION_ANNULEE", "La réservation a expiré : merci de réserver à nouveau");
    }
  }

  // LE MONTANT VIENT DU SERVEUR : le reste à payer de la facture, jamais un chiffre envoyé par le navigateur.
  const montant = facture.montantTotal - facture.montantPaye;
  if (montant < MONTANT_MINIMUM) throw RegleMetier(`Montant trop faible pour un paiement en ligne (minimum ${MONTANT_MINIMUM} Ar)`);

  // Un lien en attente, pour le même montant et créé il y a moins de 30 s : on le renvoie (double clic, retour arrière).
  const enAttente = await prisma.paiement.findFirst({ where: { factureId: facture.id, statut: "EN_ATTENTE" } });
  const recent = enAttente !== null && Date.now() - enAttente.createdAt.getTime() < REUTILISATION_LIEN_MS;
  if (enAttente?.urlPaiement && enAttente.montant === montant && recent) {
    return { paiementId: enAttente.id, url: enAttente.urlPaiement, montant };
  }
  if (enAttente) {
    // Montant changé (consommation ajoutée), lien trop ancien (peut-être consommé sur Papi) ou jamais obtenu : on le remplace.
    await prisma.paiement.updateMany({
      where: { id: enAttente.id, statut: "EN_ATTENTE" },
      data: { statut: "ECHOUE", erreur: "Remplacé par un nouveau lien de paiement" },
    });
  }

  // Jeton secret, placé dans l'URL de notification. On n'en garde que l'empreinte :
  // même avec une copie de la base, personne ne peut fabriquer une notification valide.
  const jeton = randomBytes(32).toString("base64url");
  let paiementId: string;
  try {
    const p = await prisma.paiement.create({ data: { factureId: facture.id, montant, jetonHash: empreinteSha256(jeton) } });
    paiementId = p.id;
  } catch (err) {
    // Deux demandes au même instant : l'index unique partiel n'autorise qu'UN paiement EN_ATTENTE.
    if (lireErreurBase(err)?.contrainte === "paiement_un_en_attente_par_facture") {
      const autre = await prisma.paiement.findFirst({ where: { factureId: facture.id, statut: "EN_ATTENTE" } });
      if (autre?.urlPaiement) return { paiementId: autre.id, url: autre.urlPaiement, montant: autre.montant };
      throw new AppError(409, "PAIEMENT_EN_COURS", "Un lien de paiement est en cours de création, réessayez");
    }
    throw err;
  }

  // APPEL RÉSEAU, HORS DE TOUTE TRANSACTION : Papi peut mettre plusieurs secondes à répondre.
  const retour = `${env.FRONT_URL}/paiement/retour?paiement=${paiementId}`;
  try {
    const lien = await creerLienPaiement({
      reference: paiementId,
      montant,
      description: `Hôtel – facture ${facture.numero}`,
      clientNom: facture.clientNom,
      clientEmail: facture.clientEmail,
      clientTelephone: facture.clientTelephone,
      notificationUrl: `${env.PUBLIC_URL}/api/paiements/notification?paiement=${paiementId}&jeton=${jeton}`,
      // successUrl n'est JAMAIS une preuve : la page de retour se contente d'interroger le statut.
      successUrl: retour,
      failureUrl: `${retour}&echec=1`,
    });
    await prisma.paiement.update({
      where: { id: paiementId },
      data: { urlPaiement: lien.url, notificationTokenHash: empreinteSha256(lien.notificationToken) },
    });
    return { paiementId, url: lien.url, montant };
  } catch (err) {
    await prisma.paiement.updateMany({
      where: { id: paiementId, statut: "EN_ATTENTE" },
      data: { statut: "ECHOUE", erreur: err instanceof AppError ? err.code : "ERREUR_INCONNUE" },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. Papi nous notifie : on vérifie le jeton, on met en file, on répond 200 tout de suite
// ---------------------------------------------------------------------------

const requeteSchema = z.object({ paiement: z.uuid(), jeton: z.string().min(20).max(100) });

export async function recevoirNotification(query: unknown, corps: unknown): Promise<void> {
  const q = requeteSchema.safeParse(query);
  if (!q.success) throw NonAutorise("Notification non authentifiée");

  const paiement = await prisma.paiement.findUnique({ where: { id: q.data.paiement } });
  // Même réponse pour « paiement inconnu » et « mauvais jeton » : on ne renseigne pas un attaquant.
  if (!paiement?.jetonHash || !correspondAEmpreinte(q.data.jeton, paiement.jetonHash)) {
    logger.warn({ paiementId: q.data.paiement }, "notification Papi refusée : jeton invalide");
    throw NonAutorise("Notification non authentifiée");
  }

  const notification = notificationSchema.parse(corps ?? {});
  // Idempotence : la même notification renvoyée par Papi donne le même jobId, BullMQ ignore le doublon.
  const cle = notification.paymentReference ?? `${paiement.id}-${lireStatut(notification.paymentStatus)}`;
  await bus.file(FILE_NOTIFICATIONS).add(
    "notification",
    { paiementId: paiement.id, notification },
    {
      jobId: `papi-${cle}`.replaceAll(":", "-"), // BullMQ interdit « : » dans un jobId
      attempts: 8,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    },
  );
  logger.info({ paiementId: paiement.id, statut: notification.paymentStatus }, "notification Papi mise en file");
}

// ---------------------------------------------------------------------------
// 3. Le worker traite la notification (réessayé par BullMQ en cas d'erreur passagère)
// ---------------------------------------------------------------------------

const jobSchema = z.object({ paiementId: z.uuid(), notification: notificationSchema });

// On garde ce que Papi annonce (référence, moyen, montant reçu) : sans la référence Papi,
// impossible de retrouver la transaction pour la rembourser.
async function marquerAnomalie(paiementId: string, depuis: StatutPaiement[], raison: string, n: NotificationPapi) {
  const referencePapi = n.paymentReference ?? null;
  await prisma.paiement.updateMany({
    where: { id: paiementId, statut: { in: depuis } },
    data: {
      statut: "ANOMALIE",
      erreur: raison,
      referenceExterne: referencePapi,
      methode: lireMethode(n.paymentMethod),
      montantRecu: Number.isInteger(n.amount) ? n.amount : null,
    },
  });
  // L'argent a été débité : un humain doit s'en occuper (remboursement ou régularisation).
  logger.error({ paiementId, referencePapi, montantRecu: n.amount, raison }, "ANOMALIE DE PAIEMENT : intervention manuelle nécessaire");
}

export async function traiterNotification(donnees: unknown): Promise<void> {
  const { paiementId, notification: n } = jobSchema.parse(donnees);
  const p = await prisma.paiement.findUnique({ where: { id: paiementId } });
  if (!p) return;

  // Seconde vérification d'authenticité : le notificationToken que Papi nous a donné à la création du lien.
  if (!p.notificationTokenHash) throw new Error("notificationToken pas encore enregistré"); // réessai
  if (!n.notificationToken || !correspondAEmpreinte(n.notificationToken, p.notificationTokenHash)) {
    logger.error({ paiementId }, "notification Papi refusée : notificationToken invalide");
    throw new UnrecoverableError("notificationToken invalide"); // inutile de réessayer
  }
  if (n.merchantPaymentReference && n.merchantPaymentReference !== p.id) {
    logger.error({ paiementId, recu: n.merchantPaymentReference }, "notification Papi : référence marchande incohérente");
    throw new UnrecoverableError("référence marchande incohérente");
  }

  const issue = lireStatut(n.paymentStatus);
  if (issue === "en_attente" || issue === "inconnue") {
    logger.info({ paiementId, statut: n.paymentStatus }, "notification Papi sans décision : rien à faire");
    return;
  }

  if (issue === "echec") {
    await prisma.paiement.updateMany({
      where: { id: paiementId, statut: "EN_ATTENTE" },
      data: { statut: "ECHOUE", erreur: n.message ?? "Paiement refusé", referenceExterne: n.paymentReference ?? null },
    });
    return;
  }

  // --- Paiement réussi ---
  if (p.statut === "REUSSI" || p.statut === "ANOMALIE") return; // déjà traité
  if (p.statut === "ECHOUE") {
    return marquerAnomalie(paiementId, ["ECHOUE"], "Argent reçu sur un lien remplacé ou refusé", n);
  }
  // Le montant reçu doit être EXACTEMENT celui demandé, en Ariary.
  if (n.amount !== p.montant || (n.currency && n.currency.toUpperCase() !== "MGA")) {
    return marquerAnomalie(paiementId, ["EN_ATTENTE"], `Montant incohérent : reçu ${n.amount} ${n.currency ?? ""}, attendu ${p.montant} MGA`, n);
  }

  const methode = lireMethode(n.paymentMethod);
  if (!methode) logger.warn({ paiementId, methode: n.paymentMethod }, "moyen de paiement Papi inconnu");

  try {
    await prisma.$transaction(async (tx) => {
      // Condition dans l'écriture : deux notifications différentes pour le même paiement
      // (ou deux workers) ne peuvent pas encaisser deux fois. La seconde obtient count = 0.
      const { count } = await tx.paiement.updateMany({
        where: { id: paiementId, statut: "EN_ATTENTE" },
        data: { statut: "REUSSI", methode, referenceExterne: n.paymentReference ?? null },
      });
      if (count === 0) return;
      await appliquerPaiement(tx, p.factureId, paiementId, p.montant);
    });
  } catch (err) {
    // La facture a déjà été soldée entre-temps (espèces à la réception, autre paiement…) :
    // la base refuse le surpaiement, la transaction est annulée, on signale l'anomalie.
    if (lireErreurBase(err)?.contrainte === "facture_pas_de_surpaiement") {
      return marquerAnomalie(paiementId, ["EN_ATTENTE"], "Facture déjà soldée : paiement en trop", n);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Lecture (page de retour du client : elle INTERROGE le statut)
// ---------------------------------------------------------------------------

export async function trouverPaiementPour(id: string, identite: Identite) {
  const p = await prisma.paiement.findUnique({
    where: { id },
    select: { ...CHAMPS_PAIEMENT, factureId: true, facture: { select: { clientId: true, numero: true, statut: true } } },
  });
  if (!p || (identite.role === "CLIENT" && p.facture.clientId !== identite.id)) throw NotFound("Paiement");
  const { facture, ...paiement } = p;
  return { ...paiement, facture: { numero: facture.numero, statut: facture.statut } };
}
