import { z } from "zod";
import { AppError, EN_TETE_CLE_INTERNE, NotFound } from "@hotel/commun";
import { env } from "./config/env.js";

// Client REST du service hebergement (routes /interne, clé partagée entre services).
// Appel SYNCHRONE : au moment de payer, on a besoin d'une réponse immédiate sur l'état de la réservation.
const reservationSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  statut: z.enum(["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS", "TERMINEE", "ANNULEE"]),
  clientId: z.uuid().nullable(),
  clientNom: z.string(),
  clientEmail: z.string(),
  clientTelephone: z.string(),
  langue: z.enum(["FR", "MG", "EN"]),
  montantTotal: z.number().int(),
  dateArrivee: z.iso.datetime(),
  dateDepart: z.iso.datetime(),
  chambre: z.object({ numero: z.string(), categorie: z.object({ code: z.string() }) }),
  nuitees: z.array(z.unknown()),
});

export type ReservationLue = z.infer<typeof reservationSchema>;

export async function lireReservation(id: string): Promise<ReservationLue> {
  let res: Response;
  try {
    res = await fetch(`${env.HEBERGEMENT_URL}/interne/reservations/${id}`, {
      headers: { [EN_TETE_CLE_INTERNE]: env.CLE_INTERNE },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new AppError(502, "HEBERGEMENT_INJOIGNABLE", "Service hébergement indisponible");
  }
  if (res.status === 404) throw NotFound("Réservation");
  if (!res.ok) throw new AppError(502, "HEBERGEMENT_ERREUR", "Service hébergement indisponible");
  return reservationSchema.parse(await res.json());
}
