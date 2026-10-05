import { Router } from "express";
import * as controller from "./categorie.controller.js";

export const routeurCategories = Router();

routeurCategories.get("/", controller.lister);
routeurCategories.get("/:id", controller.detail);
routeurCategories.post("/", controller.creer);
