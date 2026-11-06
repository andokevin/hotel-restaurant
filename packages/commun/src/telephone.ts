import { z } from "zod";
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
