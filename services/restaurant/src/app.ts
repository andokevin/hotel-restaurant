import express from "express";
import helmet from "helmet";
import { creerGestionnaireErreurs, exigerCleInterne, journalRequetes } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { routeur } from "./routes.js";

export const app = express();
app.use(helmet());
app.use(express.json());
app.use(journalRequetes(logger));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "restaurant" });
});
app.use(exigerCleInterne(env.CLE_INTERNE));
app.use(routeur);
app.use(creerGestionnaireErreurs({ logger }));
