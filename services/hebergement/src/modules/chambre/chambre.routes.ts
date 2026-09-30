import { Router } from "express";
import * as controller from "./chambre.controller.js";

export const routeurChambres = Router();

routeurChambres.get("/", controller.lister);
routeurChambres.get("/:id", controller.detail);
routeurChambres.post("/", controller.creer);