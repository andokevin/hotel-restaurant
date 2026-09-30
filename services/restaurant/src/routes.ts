import { Router, type Request } from "express";
import { lireId, lireIdentite, NonAutorise } from "@hotel/commun";
import { creerCommandeSchema, filtreCommandeSchema, imputerSchema, statutSchema } from "./modules/commande/commande.schema.js";
import * as commandes from "./modules/commande/commande.service.js";
import { creerMenuSchema, creerPlatSchema, modifierPlatSchema } from "./modules/menu/menu.schema.js";
import * as menus from "./modules/menu/menu.service.js";

const identite = (req: Request) => {
  const i = lireIdentite(req);
  if (!i) throw NonAutorise();
  return i;
};

export const routeur = Router();

// Menus (lane Restaurant « Définir les menus » + lane Communication « Publier »)
routeur.get("/menus/publies", async (_req, res) => void res.json(await menus.menusPublies()));
routeur.get("/menus", async (_req, res) => void res.json(await menus.tousLesMenus()));
routeur.post("/menus", async (req, res) => void res.status(201).json(await menus.creerMenu(creerMenuSchema.parse(req.body))));
routeur.post("/menus/:id/plats", async (req, res) => void res.status(201).json(await menus.ajouterPlat(lireId(req), creerPlatSchema.parse(req.body))));
routeur.patch("/plats/:id", async (req, res) => void res.json(await menus.modifierPlat(lireId(req), modifierPlatSchema.parse(req.body))));
routeur.post("/menus/:id/publier", async (req, res) => void res.json(await menus.publier(lireId(req), true)));
routeur.post("/menus/:id/depublier", async (req, res) => void res.json(await menus.publier(lireId(req), false)));
routeur.get("/menus/:id/texte-facebook", async (req, res) => void res.json(await menus.texteFacebook(lireId(req))));

// Commandes
routeur.get("/commandes", async (req, res) => void res.json(await commandes.listerCommandes(filtreCommandeSchema.parse(req.query).statut)));
routeur.post("/commandes", async (req, res) => void res.status(201).json(await commandes.creerCommande(creerCommandeSchema.parse(req.body), identite(req))));
routeur.post("/commandes/:id/statut", async (req, res) => void res.json(await commandes.changerStatut(lireId(req), statutSchema.parse(req.body).statut)));
routeur.post("/commandes/:id/imputer", async (req, res) => void res.json(await commandes.imputerALaChambre(lireId(req), imputerSchema.parse(req.body).chambreNumero)));
routeur.post("/commandes/:id/facturer", async (req, res) => void res.status(201).json(await commandes.facturer(lireId(req))));
