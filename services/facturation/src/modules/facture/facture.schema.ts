import { z } from "zod";

export const filtreFactureSchema = z.object({
  reservationId: z.uuid().optional(),
  statut: z.enum(["EMISE", "PAYEE", "CLOTUREE", "ANNULEE"]).optional(),
});

// Encaissement en espèces : le montant est saisi par la réceptionniste (billets reçus),
// et la base refuse tout ce qui dépasse le reste à payer.
export const encaissementSchema = z.object({ montant: z.number().int().positive() }).strict();
