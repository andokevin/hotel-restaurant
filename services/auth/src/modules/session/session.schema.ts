import { z } from "zod";
import { telephone } from "@hotel/commun";
import { email } from "../utilisateur/utilisateur.schema.js";

// Un seul champ « identifiant » : le téléphone (identifiant principal) ou l'email.
// Un "@" suffit à distinguer les deux.
export const connexionSchema = z.object({
  identifiant: z.union([
    email.transform((valeur) => ({ email: valeur })),
    telephone.transform((valeur) => ({ telephone: valeur })),
  ]),
  motDePasse: z.string().min(1).max(128),
});

export type ConnexionDTO = z.infer<typeof connexionSchema>;
