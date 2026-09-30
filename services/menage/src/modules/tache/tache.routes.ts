import { Router, type Request } from "express";
import { lireId, lireIdentite, NonAutorise, type Identite } from "@hotel/commun";
import { filtreTacheSchema, terminerSchema } from "./tache.schema.js";
import * as service from "./tache.service.js";

const identiteRequise = (req: Request): Identite => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  return identite;
};

export const routeurTaches = Router();

routeurTaches.get("/", async (req, res) => {
  res.json(await service.listerTaches(filtreTacheSchema.parse(req.query)));
});
routeurTaches.post("/:id/demarrer", async (req, res) => {
  res.json(await service.demarrerTache(lireId(req), identiteRequise(req)));
});
routeurTaches.post("/:id/terminer", async (req, res) => {
  res.json(await service.terminerTache(lireId(req), identiteRequise(req), terminerSchema.parse(req.body)));
});
