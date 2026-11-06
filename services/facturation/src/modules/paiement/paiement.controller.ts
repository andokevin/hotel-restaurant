import type { Request, Response } from "express";
import { lireId, lireIdentite, NonAutorise, type Identite } from "@hotel/commun";
import { demandePaiementSchema } from "./paiement.schema.js";
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

// Appelée par la page de retour du front : « le client est revenu de Papi avec ce lien ».
export const retour = async (req: Request, res: Response) => {
  await service.marquerVisite(lireId(req), identiteRequise(req));
  res.status(204).end();
};
