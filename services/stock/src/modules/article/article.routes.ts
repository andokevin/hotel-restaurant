import { Router } from "express";
import { lireId, lireIdentite, NonAutorise } from "@hotel/commun";
import { creerArticleSchema, jourSchema, mouvementManuelSchema } from "./article.schema.js";
import * as service from "./article.service.js";

export const routeurArticles = Router();

routeurArticles.get("/", async (_req, res) => {
  res.json(await service.listerArticles());
});
routeurArticles.post("/", async (req, res) => {
  res.status(201).json(await service.creerArticle(creerArticleSchema.parse(req.body)));
});
routeurArticles.get("/:id/mouvements", async (req, res) => {
  res.json(await service.historique(lireId(req)));
});
routeurArticles.post("/:id/mouvements", async (req, res) => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  res.status(201).json(await service.mouvementManuel(lireId(req), mouvementManuelSchema.parse(req.body), identite));
});

// Interne : utilisé par comptabilite (contrôle de 23 h)
export const routeurInterne = Router();
routeurInterne.get("/sorties-menage", async (req, res) => {
  res.json(await service.sortiesMenageDuJour(jourSchema.parse(req.query).jour));
});
