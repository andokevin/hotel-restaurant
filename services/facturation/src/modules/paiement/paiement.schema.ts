import { z } from "zod";

// Payer la facture d'une réservation (parcours client) OU une facture précise (réception).
// Aucun montant ici : il est TOUJOURS calculé par le serveur.
export const demandePaiementSchema = z.union([
  z.object({ reservationId: z.uuid() }).strict(),
  z.object({ factureId: z.uuid() }).strict(),
]);

// Traitement d'une anomalie : le commentaire est obligatoire (trace pour la comptabilité).
export const traitementAnomalieSchema = z.object({
  commentaire: z.string().trim().min(3, "Expliquez ce qui a été fait (3 caractères minimum)").max(500),
});

export type DemandePaiementDTO = z.infer<typeof demandePaiementSchema>;
export type TraitementAnomalieDTO = z.infer<typeof traitementAnomalieSchema>;
