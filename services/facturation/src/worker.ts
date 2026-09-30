import { Worker } from "bullmq";
import { prisma } from "./db.js";
import { connexionRedis, type JobCallbackPapi } from "./queue.js";
import { confirmerReservation } from "./hebergement.js";
import { METHODES_PAPI } from "./papi.js";
import { logger } from "./logger.js";

export const demarrerWorker = () =>
  new Worker<JobCallbackPapi>(
    "callbacks-papi",
    async (job) => {
      const d = job.data;
      const paiement = await prisma.paiement.findUnique({
        where: { id: d.paiementId },
        include: { facture: true },
      });
      if (!paiement) return;

      // Déjà traité (réessai) : on s'assure juste que la suite a bien été faite
      if (paiement.statut === "REUSSI") {
        if (paiement.facture.reservationId) await confirmerReservation(paiement.facture.reservationId);
        return;
      }
      if (paiement.statut === "ECHOUE") return;

      if (d.status !== 200) {
        await prisma.paiement.update({
          where: { id: paiement.id },
          data: { statut: "ECHOUE", erreur: d.errorMessage || "Paiement refusé", referenceExterne: d.transactionId },
        });
        return;
      }

      if (Math.round(d.montant) !== paiement.montant) {
        await prisma.paiement.update({
          where: { id: paiement.id },
          data: { statut: "ECHOUE", erreur: `Montant incohérent : reçu ${d.montant}, attendu ${paiement.montant}` },
        });
        logger.error({ callback: d }, "ALERTE : montant incohérent");
        return;
      }

      await prisma.$transaction([
        prisma.paiement.update({
          where: { id: paiement.id },
          data: {
            statut: "REUSSI",
            referenceExterne: d.transactionId,
            methode: (d.paymentMethod && METHODES_PAPI[d.paymentMethod as keyof typeof METHODES_PAPI]) || "AUTRE",
          },
        }),
        prisma.facture.update({
          where: { id: paiement.factureId },
          data: { statut: "PAYEE", montantPaye: { increment: paiement.montant } },
        }),
      ]);

      if (paiement.facture.reservationId) {
        await confirmerReservation(paiement.facture.reservationId);
      }
    },
    { connection: connexionRedis },
  );