import { z } from "zod";

export const creerCategorieSchema = z.object({
  code: z.enum(["STANDARD", "SUITE_SENIOR", "SUITE_PRESTIGE"]),
  libelle: z.object({ fr: z.string().min(1), mg: z.string().optional(), en: z.string().optional() }),
  capacite: z.number().int().positive(),
  tarifNuit: z.number().int().positive(),
});

export type CreerCategorieDTO = z.infer<typeof creerCategorieSchema>;