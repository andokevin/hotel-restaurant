import type { Request, Response } from "express";
import { lireId } from "@hotel/commun";
import { creationUtilisateurSchema, miseAJourUtilisateurSchema } from "./utilisateur.schema.js";
import * as service from "./utilisateur.service.js";

export const lister = async (_req: Request, res: Response) => {
  res.json(await service.listerUtilisateurs());
};

export const creer = async (req: Request, res: Response) => {
  const data = creationUtilisateurSchema.parse(req.body);
  res.status(201).json(await service.creerUtilisateur(data));
};

export const mettreAJour = async (req: Request, res: Response) => {
  const data = miseAJourUtilisateurSchema.parse(req.body);
  res.json(await service.mettreAJourUtilisateur(lireId(req), data));
};
