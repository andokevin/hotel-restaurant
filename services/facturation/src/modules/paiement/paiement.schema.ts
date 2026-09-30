import { z } from "zod";

// Payer la facture d'une réservation (parcours client) OU une facture précise (réception).
// Aucun montant ici : il est TOUJOURS calculé par le serveur.
export const demandePaiementSchema = z.union([
  z.object({ reservationId: z.uuid() }).strict(),
  z.object({ factureId: z.uuid() }).strict(),
]);

export type DemandePaiementDTO = z.infer<typeof demandePaiementSchema>;
