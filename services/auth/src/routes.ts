import { Router } from "express";
import { exigerRoles } from "@hotel/commun";
import * as session from "./modules/session/session.controller.js";
import * as utilisateur from "./modules/utilisateur/utilisateur.controller.js";

export const routeurAuth = Router();

routeurAuth.post("/inscription", session.inscription);
routeurAuth.post("/connexion", session.connexion);
routeurAuth.post("/rafraichir", session.rafraichir);
routeurAuth.post("/deconnexion", session.deconnexion);
routeurAuth.get("/moi", session.moi);

// Gestion des comptes : ADMIN uniquement, vérifié ICI aussi (défense en profondeur)
routeurAuth.get("/utilisateurs", exigerRoles("ADMIN"), utilisateur.lister);
routeurAuth.post("/utilisateurs", exigerRoles("ADMIN"), utilisateur.creer);
routeurAuth.patch("/utilisateurs/:id", exigerRoles("ADMIN"), utilisateur.mettreAJour);
