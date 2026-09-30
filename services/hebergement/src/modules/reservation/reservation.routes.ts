import { Router } from "express";
import * as controller from "./reservation.controller.js";

// Routes publiques : passent par la gateway, qui contrôle les rôles (services/api-gateway/src/regles.ts).
export const routeurReservations = Router();

routeurReservations.post("/", controller.creer);
routeurReservations.get("/", controller.lister);
// Les chemins fixes AVANT "/:id", sinon "mes-reservations" serait lu comme un id.
routeurReservations.get("/mes-reservations", controller.mesReservations);
routeurReservations.get("/departs", controller.departs);
routeurReservations.get("/:id", controller.detail);
routeurReservations.post("/:id/annuler", controller.annuler);
routeurReservations.post("/:id/check-in", controller.checkIn);
routeurReservations.post("/:id/check-out", controller.checkOut);

// Routes internes : montées sous /interne/reservations, absentes de la gateway.
export const routeurReservationsInterne = Router();

routeurReservationsInterne.get("/en-cours", controller.enCoursInterne); // ?chambre=204 (restaurant)
routeurReservationsInterne.get("/statistiques", controller.statistiquesInterne); // ?jour=AAAA-MM-JJ (comptabilité)
routeurReservationsInterne.get("/:id", controller.detailInterne);
routeurReservationsInterne.post("/:id/confirmer", controller.confirmerInterne);
