import type { RequestHandler } from "express";
import { Interdit, NonAutorise } from "./erreurs.js";
import { lireIdentite, type Role } from "./identite.js";

// Défense en profondeur : la gateway contrôle déjà les rôles, mais une route sensible
// (gestion des comptes, par exemple) le revérifie dans le service lui-même.
export const exigerRoles = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  if (!roles.includes(identite.role)) throw Interdit();
  next();
};
