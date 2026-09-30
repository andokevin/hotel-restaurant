import type { Request, Response } from "express";
import { lireId } from "@hotel/commun";
import { creerChambreSchema, filtreChambreSchema } from "./chambre.schema.js";
import * as service from "./chambre.service.js";

export const lister = async (req: Request, res: Response) => {
  const filtre = filtreChambreSchema.parse(req.query);
  res.json(await service.listerChambres(filtre));
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverChambre(lireId(req)));
};

export const creer = async (req: Request, res: Response) => {
  const data = creerChambreSchema.parse(req.body);
  res.status(201).json(await service.creerChambre(data));
};
