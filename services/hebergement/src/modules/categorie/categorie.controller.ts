import type { Request, Response } from "express";
import { lireId } from "@hotel/commun";
import { creerCategorieSchema, filtreCategorieSchema } from "./categorie.schema.js";
import * as service from "./categorie.service.js";

export const lister = async (req: Request, res: Response) => {
  res.json(await service.listerCategories(filtreCategorieSchema.parse(req.query)));
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverCategorie(lireId(req)));
};

export const creer = async (req: Request, res: Response) => {
  const data = creerCategorieSchema.parse(req.body);
  res.status(201).json(await service.creerCategorie(data));
};
