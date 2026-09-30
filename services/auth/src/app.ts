import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { creerGestionnaireErreurs, exigerCleInterne, journalRequetes } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { routeurAuth } from "./routes.js";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(journalRequetes(logger));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth" });
});

// Tout le reste ne répond qu'à la gateway (ou à un autre service) : elle seule connaît la clé interne.
app.use(exigerCleInterne(env.CLE_INTERNE));

app.use("/auth", routeurAuth);

app.use(
  creerGestionnaireErreurs({
    logger,
    contraintes: {
      utilisateur_telephone_key: {
        status: 409,
        code: "TELEPHONE_DEJA_UTILISE",
        message: "Un compte existe déjà avec ce numéro",
      },
      utilisateur_email_key: { status: 409, code: "EMAIL_DEJA_UTILISE", message: "Un compte existe déjà avec cet email" },
    },
  }),
);
