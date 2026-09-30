import type { Request } from "express";
import { z } from "zod";

// Les rôles = les lanes du BPMN, plus ADMIN et CLIENT.
export const ROLES = [
  "ADMIN",
  "RECEPTIONNISTE",
  "FEMME_MENAGE",
  "RESTAURANT",
  "COMPTABLE",
  "COMMUNICATION",
  "CLIENT",
] as const;

export type Role = (typeof ROLES)[number];

// En-têtes posés par la gateway APRÈS vérification du JWT.
// La gateway supprime toujours ceux envoyés par le navigateur : un client ne peut pas
// se déclarer ADMIN en ajoutant lui-même "x-utilisateur-role: ADMIN".
export const EN_TETE_UTILISATEUR_ID = "x-utilisateur-id";
export const EN_TETE_UTILISATEUR_ROLE = "x-utilisateur-role";

export type Identite = { id: string; role: Role };

const identiteSchema = z.object({ id: z.uuid(), role: z.enum(ROLES) });

// Identité de l'utilisateur de la requête, ou null (route publique, appel entre services).
// À n'utiliser que derrière exigerCleInterne : sans elle, n'importe qui pourrait forger ces en-têtes.
export const lireIdentite = (req: Request): Identite | null => {
  const r = identiteSchema.safeParse({
    id: req.get(EN_TETE_UTILISATEUR_ID),
    role: req.get(EN_TETE_UTILISATEUR_ROLE),
  });
  return r.success ? r.data : null;
};

// Contrat du jeton d'accès, partagé par auth (qui signe) et la gateway (qui vérifie).
// "iss" dit qui l'a émis, "aud" à qui il est destiné : un JWT émis pour une autre application
// avec la même clé serait refusé.
export const JWT_EMETTEUR = "hotel-auth";
export const JWT_AUDIENCE = "hotel-api";
export const JWT_ALGORITHME = "EdDSA";
