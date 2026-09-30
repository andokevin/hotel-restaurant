import { Router } from "express";
import * as controller from "./reservation.controller.js";

// Routes publiques (passeront par la gateway, avec contrôle des rôles en phase 2)
export const routeurReservations = Router();

routeurReservations.get("/", controller.lister);
routeurReservations.get("/:id", controller.detail);
routeurReservations.post("/", controller.creer);

// Routes internes : montées sous /interne/reservations, protégées par la clé interne.
// Confirmer sans payer ne doit être possible pour personne d'autre que facturation.
export const routeurReservationsInterne = Router();

routeurReservationsInterne.get("/:id", controller.detail);
routeurReservationsInterne.post("/:id/confirmer", controller.confirmer);
