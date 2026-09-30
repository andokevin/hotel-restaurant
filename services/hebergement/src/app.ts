import express from "express";
import cors from "cors";
import helmet from "helmet";
import { gestionnaireErreurs } from "./middlewares/erreur.js";
import { routeurCategories } from "./modules/categorie/categorie.routes.js";
import { routeurChambres } from "./modules/chambre/chambre.routes.js";
import { routeurReservations } from "./modules/reservation/reservation.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hebergement" });
});

app.use("/categories", routeurCategories);
app.use("/chambres", routeurChambres);
app.use("/reservations", routeurReservations);

app.use(gestionnaireErreurs);   