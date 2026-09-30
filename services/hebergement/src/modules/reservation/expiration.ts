import { bus } from "../../bus.js";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";

export const FILE_EXPIRATIONS = "hebergement.expirations";
export const DELAI_PAIEMENT_MS = 30 * 60 * 1000;

// Un job par réservation, identifié par la réservation : on peut le retrouver pour l'annuler.
const idJob = (reservationId: string) => `expiration-${reservationId}`;

// Appelé APRÈS le commit de la réservation (jamais d'appel réseau dans une transaction).
// Si Redis est indisponible à ce moment, le balayage périodique rattrapera la réservation.
export async function planifierExpiration(reservationId: string, expireLe: Date): Promise<void> {
  try {
    await bus.file(FILE_EXPIRATIONS).add(
      "expirer",
      { reservationId },
      { jobId: idJob(reservationId), delay: Math.max(0, expireLe.getTime() - Date.now()), removeOnComplete: true },
    );
  } catch (err) {
    logger.warn({ err, reservationId }, "expiration non planifiée : le balayage prendra le relais");
  }
}

// Appelé quand la réservation est payée ou annulée. C'est une OPTIMISATION :
// même si le job n'est pas supprimé (Redis coupé), expirerReservation ne fera rien,
// car elle ne touche qu'une réservation encore EN_ATTENTE_PAIEMENT.
export async function annulerExpiration(reservationId: string): Promise<void> {
  try {
    await bus.file(FILE_EXPIRATIONS).remove(idJob(reservationId));
  } catch (err) {
    logger.warn({ err, reservationId }, "job d'expiration non supprimé (sans conséquence)");
  }
}

// Le job lui-même. La condition du WHERE fait tout le travail :
//  - statut EN_ATTENTE_PAIEMENT : une réservation payée entre-temps n'est pas touchée ;
//  - expire_le <= maintenant : un job exécuté trop tôt ne fait rien.
// Pas de lecture préalable, donc pas de fenêtre entre « je lis » et « j'écris ».
export async function expirerReservation(reservationId: string): Promise<boolean> {
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, statut: "EN_ATTENTE_PAIEMENT", expireLe: { lte: new Date() } },
    data: { statut: "ANNULEE", version: { increment: 1 } },
  });
  if (count > 0) logger.info({ reservationId }, "réservation expirée : chambre libérée");
  return count > 0;
}

// Filet de sécurité, toutes les minutes : annule toutes les réservations expirées
// dont le job a été perdu (Redis vidé, planification échouée…).
export async function balayerExpirations(): Promise<number> {
  const { count } = await prisma.reservation.updateMany({
    where: { statut: "EN_ATTENTE_PAIEMENT", expireLe: { lte: new Date() } },
    data: { statut: "ANNULEE", version: { increment: 1 } },
  });
  if (count > 0) logger.info({ count }, "balayage : réservations expirées annulées");
  return count;
}
