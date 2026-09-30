import express from "express";
import cors from "cors";
import helmet from "helmet";
import { creerGestionnaireErreurs, exigerCleInterne, journalRequetes } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { routeurCategories } from "./modules/categorie/categorie.routes.js";
import { routeurChambres } from "./modules/chambre/chambre.routes.js";
import { routeurReservations, routeurReservationsInterne } from "./modules/reservation/reservation.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(journalRequetes(logger));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hebergement" });
});

app.use("/categories", routeurCategories);
app.use("/chambres", routeurChambres);
app.use("/reservations", routeurReservations);

// Routes réservées aux autres services (jamais exposées par la gateway)
app.use("/interne/reservations", exigerCleInterne(env.CLE_INTERNE), routeurReservationsInterne);

app.use(
  creerGestionnaireErreurs({
    logger,
    contraintes: {
      reservation_sans_chevauchement: {
        status: 409,
        code: "CHAMBRE_INDISPONIBLE",
        message: "Cette chambre est déjà réservée sur ces dates",
      },
    },
  }),
);
