// Règles de validation partagées par les formulaires (mêmes règles que le back).
import { z } from "zod";

// "+261 34 12 345 67", "034 12 345 67" et "0341234567" → "0341234567"
export const normaliserTelephone = (brut: string): string => {
  const chiffres = brut.replace(/[\s.-]/g, "");
  return chiffres.startsWith("+261") ? `0${chiffres.slice(4)}` : chiffres;
};

const REGEX_TELEPHONE = /^0(32|33|34|37|38)\d{7}$/;

// On valide la forme normalisée, mais on garde la saisie telle quelle dans le formulaire ;
// la normalisation est faite au moment de l'envoi (normaliserTelephone).
export const champTelephone = z
  .string()
  .refine((v) => REGEX_TELEPHONE.test(normaliserTelephone(v)), "Numéro malgache invalide (ex. 034 12 345 67)");

export const champEmail = z.string().trim().pipe(z.email("Email invalide"));

export const champMotDePasse = z.string().min(10, "10 caractères minimum").max(128, "128 caractères maximum");

export const champNom = z.string().trim().min(2, "2 caractères minimum").max(100);

// Entier positif (montants en Ariary, quantités…). À utiliser avec register(..., { valueAsNumber: true }).
export const entierPositif = (message = "Nombre entier positif attendu") =>
  z.number(message).int(message).positive(message);

export const entierPositifOuNul = (message = "Nombre entier positif ou nul attendu") =>
  z.number(message).int(message).min(0, message);
