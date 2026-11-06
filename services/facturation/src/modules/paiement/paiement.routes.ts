import { Router } from "express";
import * as controller from "./paiement.controller.js";

export const routeurPaiements = Router();

routeurPaiements.post("/", controller.demander);
routeurPaiements.post("/notification", controller.notification); // Papi (route PUBLIQUE dans la gateway)
routeurPaiements.get("/:id", controller.detail);
routeurPaiements.post("/:id/retour", controller.retour); // le client revient de Papi (#69)
