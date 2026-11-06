import { z } from "zod";

export const creerCategorieSchema = z.object({
  code: z.enum(["STANDARD", "SUITE_SENIOR", "SUITE_PRESTIGE"]),
  libelle: z.object({ fr: z.string().min(1), mg: z.string().optional(), en: z.string().optional() }),
  capacite: z.number().int().positive(),
  tarifNuit: z.number().int().positive(),
});

// GET /categories?personnes=3 : dans l'URL tout est texte ("3"), coerce le convertit en nombre.
export const filtreCategorieSchema = z.object({
  personnes: z.coerce.number().int().min(1).optional(),
});

export type CreerCategorieDTO = z.infer<typeof creerCategorieSchema>;
export type FiltreCategorie = z.infer<typeof filtreCategorieSchema>;