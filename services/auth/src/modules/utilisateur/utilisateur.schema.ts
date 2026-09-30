import { z } from "zod";
import { ROLES } from "@hotel/commun";

// Email normalisé AVANT validation : espaces retirés, minuscules.
const email = z.string().trim().toLowerCase().pipe(z.email("Email invalide"));

// 10 caractères minimum ; 128 maximum pour qu'un « mot de passe » de 10 Mo
// ne bloque pas le processeur pendant le hachage.
const motDePasse = z.string().min(10, "10 caractères minimum").max(128);

const nomComplet = z.string().trim().min(2).max(100);

// Inscription publique : le rôle n'est PAS dans le schéma, il sera forcé à CLIENT.
// Un champ "role": "ADMIN" envoyé par le navigateur est simplement ignoré.
export const inscriptionSchema = z.object({ email, motDePasse, nomComplet });

// Création d'un compte par un ADMIN (personnel de l'hôtel)
export const creationUtilisateurSchema = z.object({ email, motDePasse, nomComplet, role: z.enum(ROLES) });

export const miseAJourUtilisateurSchema = z.object({
  actif: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
});

export type InscriptionDTO = z.infer<typeof inscriptionSchema>;
export type CreationUtilisateurDTO = z.infer<typeof creationUtilisateurSchema>;
export type MiseAJourUtilisateurDTO = z.infer<typeof miseAJourUtilisateurSchema>;
