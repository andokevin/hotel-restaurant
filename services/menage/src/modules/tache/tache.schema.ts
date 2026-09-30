import { z } from "zod";

export const filtreTacheSchema = z.object({
  date: z.iso.date().optional(), // défaut : aujourd'hui (heure de Madagascar)
  statut: z.enum(["A_FAIRE", "EN_COURS", "TERMINEE"]).optional(),
});

// Articles RÉELLEMENT remplacés (codes du service stock). Un code en double est refusé.
export const terminerSchema = z.object({
  articles: z
    .array(z.object({ code: z.string().regex(/^[A-Z_]{2,40}$/), quantite: z.number().int().min(0).max(50) }))
    .refine((a) => new Set(a.map((x) => x.code)).size === a.length, "Un article est déclaré deux fois"),
  remarques: z.string().trim().max(500).optional(),
});

export type TerminerDTO = z.infer<typeof terminerSchema>;
