import { z } from "zod";
import { UnrecoverableError } from "bullmq";
import { env } from "./config/env.js";
import { AppError, NotFound } from "./errors.js";

const reservationSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  statut: z.string(),
  montantTotal: z.number().int(),
  clientNom: z.string(),
  clientEmail: z.string().nullable(),
  chambre: z.object({ numero: z.string() }),
  nuitees: z.array(z.unknown()),
});

export async function lireReservation(id: string) {
  const res = await fetch(`${env.HEBERGEMENT_URL}/reservations/${id}`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 404) throw NotFound("Réservation");
  if (!res.ok) throw new AppError(502, "HEBERGEMENT_ERREUR", "Service hébergement indisponible");
  return reservationSchema.parse(await res.json());
}

export async function confirmerReservation(id: string) {
  const res = await fetch(`${env.HEBERGEMENT_URL}/reservations/${id}/confirmer`, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 422) {
    // Réservation expirée ou annulée : réessayer ne servira à rien
    throw new UnrecoverableError(`Réservation ${id} non confirmable : remboursement à prévoir`);
  }
  if (!res.ok) throw new Error(`Confirmation échouée (${res.status})`); // → BullMQ réessaie
}