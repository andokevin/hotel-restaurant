import { z } from "zod";

export const filtreFactureSchema = z.object({
  reservationId: z.uuid().optional(),
  statut: z.enum(["EMISE", "PAYEE", "CLOTUREE", "ANNULEE"]).optional(),
});

// Encaissement en espèces : le montant est saisi par la réceptionniste (billets reçus),
// et la base refuse tout ce qui dépasse le reste à payer.
export const factureRestaurantSchema = z.object({
  commandeId: z.uuid(),
  reference: z.string().min(1),
  clientNom: z.string().min(1).max(100),
  lignes: z.array(z.object({ libelle: z.string().min(1), quantite: z.number().int().positive(), prixUnitaire: z.number().int().positive() })).min(1),
});

export const encaissementSchema = z.object({ montant: z.number().int().positive() }).strict();
