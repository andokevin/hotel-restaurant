import { z } from "zod";

export const connexionSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email invalide")),
  motDePasse: z.string().min(1).max(128),
});

export type ConnexionDTO = z.infer<typeof connexionSchema>;
