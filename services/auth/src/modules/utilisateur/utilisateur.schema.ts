import { z } from "zod";
import { ROLES } from "@hotel/commun";

// Téléphone malgache normalisé au format local : "+261 34 12 345 67", "034 12 345 67"
// et "0341234567" désignent le même compte → stocké "0341234567".
export const normaliserTelephone = (brut: string): string => {
  const chiffres = brut.replace(/[\s.-]/g, "");
  return chiffres.startsWith("+261") ? `0${chiffres.slice(4)}` : chiffres;
};

export const telephone = z
  .string()
  .transform(normaliserTelephone)
  .pipe(z.string().regex(/^0(32|33|34|37|38)\d{7}$/, "Numéro malgache invalide (ex. 034 12 345 67)"));

// Email normalisé AVANT validation : espaces retirés, minuscules.
export const email = z.string().trim().toLowerCase().pipe(z.email("Email invalide"));

// 10 caractères minimum ; 128 maximum pour qu'un « mot de passe » de 10 Mo
// ne bloque pas le processeur pendant le hachage.
const motDePasse = z.string().min(10, "10 caractères minimum").max(128);

const nom = z.string().trim().min(2).max(100);
const langue = z.enum(["FR", "MG", "EN"]).default("FR");

// Inscription publique : le rôle n'est PAS dans le schéma, il sera forcé à CLIENT.
// Un champ "role": "ADMIN" envoyé par le navigateur est simplement ignoré.
// Téléphone : identifiant de connexion et paiement mobile. Email : obligatoire, reçus et notifications.
export const inscriptionSchema = z.object({ nom, telephone, email, motDePasse, langue });

// Création d'un compte par un ADMIN (personnel de l'hôtel)
export const creationUtilisateurSchema = inscriptionSchema.extend({ role: z.enum(ROLES) });

export const miseAJourUtilisateurSchema = z.object({
  actif: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
});

export type InscriptionDTO = z.infer<typeof inscriptionSchema>;
export type CreationUtilisateurDTO = z.infer<typeof creationUtilisateurSchema>;
export type MiseAJourUtilisateurDTO = z.infer<typeof miseAJourUtilisateurSchema>;
