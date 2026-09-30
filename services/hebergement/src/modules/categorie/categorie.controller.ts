import type { Request, Response } from "express";
import { creerCategorieSchema } from "./categorie.schema.js";
import * as service from "./categorie.service.js";

export const lister = async (_req: Request, res: Response) => {
  res.json(await service.listerCategories());
};

export const detail = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await service.trouverCategorie(id));
};

export const creer = async (req: Request, res: Response) => {
  const data = creerCategorieSchema.parse(req.body);
  const categorie = await service.creerCategorie(data);
  res.status(201).json(categorie);
};