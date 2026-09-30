import { z } from "zod";

export const creerArticleSchema = z.object({
  code: z.string().regex(/^[A-Z_]{2,40}$/, "Code en MAJUSCULES_AVEC_TIRETS"),
  libelle: z.object({ fr: z.string().min(1), mg: z.string().optional(), en: z.string().optional() }),
  seuilAlerte: z.number().int().min(0),
  consommationParNuitee: z.number().int().min(0).default(1),
});

// Mouvement saisi à la main. La sortie MENAGE, elle, ne vient QUE de l'événement menage.termine.
export const mouvementManuelSchema = z
  .object({
    type: z.enum(["ENTREE", "SORTIE"]),
    motif: z.enum(["APPROVISIONNEMENT", "AJUSTEMENT_INVENTAIRE", "PERTE"]),
    quantite: z.number().int().positive(),
  })
  .refine((m) => m.motif !== "APPROVISIONNEMENT" || m.type === "ENTREE", "Un approvisionnement est une ENTREE")
  .refine((m) => m.motif !== "PERTE" || m.type === "SORTIE", "Une perte est une SORTIE");

export const jourSchema = z.object({ jour: z.iso.date() });

export type CreerArticleDTO = z.infer<typeof creerArticleSchema>;
export type MouvementManuelDTO = z.infer<typeof mouvementManuelSchema>;
