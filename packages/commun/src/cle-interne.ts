import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { NonAutorise } from "./erreurs.js";

export const EN_TETE_CLE_INTERNE = "x-cle-interne";

// On compare les empreintes SHA-256 plutôt que les chaînes : elles ont toujours
// la même longueur (timingSafeEqual l'exige) et la comparaison se fait en temps
// constant, donc la durée de la réponse ne révèle rien sur la clé.
const empreinte = (s: string) => createHash("sha256").update(s).digest();

export const clesEgales = (recue: string, attendue: string) =>
  timingSafeEqual(empreinte(recue), empreinte(attendue));

// Protège les routes réservées aux appels entre services.
export const exigerCleInterne = (cleAttendue: string): RequestHandler => (req, _res, next) => {
  const recue = req.get(EN_TETE_CLE_INTERNE);
  if (!recue || !clesEgales(recue, cleAttendue)) {
    throw NonAutorise("Clé interne absente ou invalide");
  }
  next();
};
