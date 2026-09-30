import { z } from "zod";

export const creerChambreSchema = z.object({
  numero: z.string().min(1).max(10),
  etage: z.number().int().min(0),
  categorieId: z.uuid(),
});

export const filtreChambreSchema = z.object({
  etatMenage: z.enum(["PROPRE", "SALE", "EN_NETTOYAGE"]).optional(),
  horsService: z.enum(["true", "false"]).optional(),
});

export type CreerChambreDTO = z.infer<typeof creerChambreSchema>;
export type FiltreChambre = z.infer<typeof filtreChambreSchema>;