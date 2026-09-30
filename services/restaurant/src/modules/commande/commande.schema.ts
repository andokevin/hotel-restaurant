import { z } from "zod";

// Aucun prix ici : il est lu dans la base (table plat) au moment de la commande.
export const creerCommandeSchema = z.object({
  canal: z.enum(["SUR_PLACE", "A_EMPORTER"]), // LIVRAISON : V3
  tableNumero: z.string().trim().max(10).optional(),
  clientNom: z.string().trim().max(100).optional(),
  lignes: z
    .array(z.object({ platId: z.uuid(), quantite: z.number().int().positive().max(50) }))
    .min(1, "Une commande contient au moins un plat"),
});

export const statutSchema = z.object({ statut: z.enum(["EN_PREPARATION", "PRETE", "REMISE", "ANNULEE"]) });
export const filtreCommandeSchema = z.object({ statut: z.enum(["RECUE", "EN_PREPARATION", "PRETE", "REMISE", "ANNULEE"]).optional() });
export const imputerSchema = z.object({ chambreNumero: z.string().trim().min(1).max(10) });

export type CreerCommandeDTO = z.infer<typeof creerCommandeSchema>;
