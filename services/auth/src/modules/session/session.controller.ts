import type { CookieOptions, Request, Response } from "express";
import { lireIdentite, NonAutorise } from "@hotel/commun";
import { env } from "../../config/env.js";
import { DUREE_SESSION_MS } from "../../jetons.js";
import { inscriptionSchema } from "../utilisateur/utilisateur.schema.js";
import * as utilisateurs from "../utilisateur/utilisateur.service.js";
import { connexionSchema } from "./session.schema.js";
import * as service from "./session.service.js";

export const NOM_COOKIE = "hotel_session";

// httpOnly : le JavaScript de la page ne peut pas lire le cookie (une faille XSS ne peut pas le voler).
// sameSite strict : le navigateur ne l'envoie pas depuis un autre site (protection CSRF).
// path : envoyé uniquement aux routes /api/auth, pas à chaque requête de l'application.
const optionsCookie = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "strict",
  secure: env.COOKIE_SECURISE ? env.COOKIE_SECURISE === "true" : env.NODE_ENV === "production", // HTTPS en production
  path: env.COOKIE_CHEMIN,
  maxAge: DUREE_SESSION_MS,
});

const lireCookie = (req: Request): string | undefined => {
  const valeur: unknown = req.cookies?.[NOM_COOKIE];
  return typeof valeur === "string" ? valeur : undefined;
};

export const inscription = async (req: Request, res: Response) => {
  const data = inscriptionSchema.parse(req.body);
  res.status(201).json(await utilisateurs.inscrire(data));
};

export const connexion = async (req: Request, res: Response) => {
  const { jetonSession, ...reponse } = await service.connecter(connexionSchema.parse(req.body));
  res.cookie(NOM_COOKIE, jetonSession, optionsCookie()).json(reponse);
};

export const rafraichir = async (req: Request, res: Response) => {
  try {
    const { jetonSession, ...reponse } = await service.rafraichir(lireCookie(req));
    res.cookie(NOM_COOKIE, jetonSession, optionsCookie()).json(reponse);
  } catch (err) {
    // Session refusée : on efface aussi le cookie devenu inutile
    res.clearCookie(NOM_COOKIE, { ...optionsCookie(), maxAge: undefined });
    throw err;
  }
};

export const deconnexion = async (req: Request, res: Response) => {
  await service.deconnecter(lireCookie(req));
  res.clearCookie(NOM_COOKIE, { ...optionsCookie(), maxAge: undefined }).status(204).end();
};

export const moi = async (req: Request, res: Response) => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  res.json(await service.moi(identite.id));
};
