import { z } from "zod";

const texte = z.object({ fr: z.string().trim().min(1), mg: z.string().optional(), en: z.string().optional() });

export const creerMenuSchema = z.object({ nom: texte });
export const creerPlatSchema = z.object({
  nom: texte,
  description: texte.optional(),
  categorie: z.enum(["ENTREE", "PLAT", "DESSERT", "BOISSON"]),
  prix: z.number().int().positive(),
  tempsPreparationMin: z.number().int().min(0).max(240).default(15),
});
export const modifierPlatSchema = z.object({ disponible: z.boolean().optional(), prix: z.number().int().positive().optional() });
