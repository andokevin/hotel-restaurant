import type { Request, Response } from "express";
import { lireId, lireIdentite, NonAutorise, type Identite } from "@hotel/commun";
import { encaissementSchema, filtreFactureSchema } from "./facture.schema.js";
import * as service from "./facture.service.js";

const identiteRequise = (req: Request): Identite => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  return identite;
};

export const lister = async (req: Request, res: Response) => {
  res.json(await service.listerFactures(filtreFactureSchema.parse(req.query)));
};

export const mesFactures = async (req: Request, res: Response) => {
  res.json(await service.listerMesFactures(identiteRequise(req).id));
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverFacturePour(lireId(req), identiteRequise(req)));
};

export const encaisser = async (req: Request, res: Response) => {
  const { montant } = encaissementSchema.parse(req.body);
  res.status(201).json(await service.encaisserEspeces(lireId(req), montant, identiteRequise(req)));
};

export const cloturer = async (req: Request, res: Response) => {
  res.json(await service.cloturerFacture(lireId(req)));
};
