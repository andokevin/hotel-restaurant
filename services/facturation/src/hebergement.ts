import { z } from "zod";
import { UnrecoverableError } from "bullmq";
import { AppError, EN_TETE_CLE_INTERNE, NotFound } from "@hotel/commun";
import { env } from "./config/env.js";

// Client REST du service hebergement : on appelle ses routes /interne,
// protégées par la clé partagée entre services.
const enTetes = { [EN_TETE_CLE_INTERNE]: env.CLE_INTERNE };

const reservationSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  statut: z.enum(["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS", "TERMINEE", "ANNULEE"]),
  montantTotal: z.number().int(),
  clientNom: z.string(),
  clientEmail: z.string().nullable(),
  chambre: z.object({ numero: z.string() }),
});

export async function lireReservation(id: string) {
  const res = await fetch(`${env.HEBERGEMENT_URL}/interne/reservations/${id}`, {
    headers: enTetes,
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 404) throw NotFound("Réservation");
  if (!res.ok) throw new AppError(502, "HEBERGEMENT_ERREUR", "Service hébergement indisponible");
  return reservationSchema.parse(await res.json());
}

export async function confirmerReservation(id: string) {
  const res = await fetch(`${env.HEBERGEMENT_URL}/interne/reservations/${id}/confirmer`, {
    method: "POST",
    headers: enTetes,
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 422) {
    // Réservation expirée ou annulée : réessayer ne servira à rien
    throw new UnrecoverableError(`Réservation ${id} non confirmable : remboursement à prévoir`);
  }
  if (!res.ok) throw new Error(`Confirmation échouée (${res.status})`); // → BullMQ réessaie
}
