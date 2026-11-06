import type { Request, Response } from "express";
import { Interdit, lireId, lireIdentite, NonAutorise, type Identite } from "@hotel/commun";
import { demandePaiementSchema, traitementAnomalieSchema } from "./paiement.schema.js";
import * as service from "./paiement.service.js";

const identiteRequise = (req: Request): Identite => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  return identite;
};

export const demander = async (req: Request, res: Response) => {
  const lien = await service.demanderPaiement(demandePaiementSchema.parse(req.body), identiteRequise(req));
  res.status(201).json(lien);
};

// Appelée par Papi (serveur à serveur). Répond 200 DÈS que la notification est authentifiée
// et mise en file : le traitement se fait dans le worker, Papi n'attend pas.
export const notification = async (req: Request, res: Response) => {
  await service.recevoirNotification(req.query, req.body);
  res.status(200).json({ recu: true });
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverPaiementPour(lireId(req), identiteRequise(req)));
};

// Défense en profondeur : la gateway filtre déjà les rôles, mais une action sur l'argent
// est revérifiée ici (une erreur dans regles.ts ne doit pas suffire à l'ouvrir).
const comptableRequis = (req: Request): Identite => {
  const identite = identiteRequise(req);
  if (identite.role !== "COMPTABLE" && identite.role !== "ADMIN") throw Interdit();
  return identite;
};

export const anomalies = async (req: Request, res: Response) => {
  comptableRequis(req);
  res.json(await service.listerAnomalies());
};

export const rembourse = async (req: Request, res: Response) => {
  const identite = comptableRequis(req);
  const { commentaire } = traitementAnomalieSchema.parse(req.body);
  res.json(await service.marquerRembourse(lireId(req), commentaire, identite));
};

export const accepter = async (req: Request, res: Response) => {
  const identite = comptableRequis(req);
  const { commentaire } = traitementAnomalieSchema.parse(req.body);
  res.json(await service.accepterAnomalie(lireId(req), commentaire, identite));
};

// Appelée par la page de retour du front : « le client est revenu de Papi avec ce lien ».
export const retour = async (req: Request, res: Response) => {
  await service.marquerVisite(lireId(req), identiteRequise(req));
  res.status(204).end();
};
