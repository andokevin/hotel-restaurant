import { Router } from "express";
import * as controller from "./facture.controller.js";

export const routeurFactures = Router();

routeurFactures.get("/", controller.lister);
routeurFactures.get("/mes-factures", controller.mesFactures); // avant "/:id"
routeurFactures.get("/:id", controller.detail);
routeurFactures.post("/:id/encaissements", controller.encaisser);
routeurFactures.post("/:id/cloturer", controller.cloturer);
