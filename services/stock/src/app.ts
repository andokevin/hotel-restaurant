import express from "express";
import helmet from "helmet";
import { creerGestionnaireErreurs, exigerCleInterne, journalRequetes } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { routeurArticles, routeurInterne } from "./modules/article/article.routes.js";

export const app = express();
app.use(helmet());
app.use(express.json());
app.use(journalRequetes(logger));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "stock" });
});
app.use(exigerCleInterne(env.CLE_INTERNE));
app.use("/articles", routeurArticles);
app.use("/interne", routeurInterne);
app.use(
  creerGestionnaireErreurs({
    logger,
    contraintes: {
      stock_jamais_negatif: { status: 422, code: "STOCK_INSUFFISANT", message: "Le stock ne peut pas devenir négatif" },
      article_code_key: { status: 409, code: "ARTICLE_EXISTANT", message: "Un article existe déjà avec ce code" },
    },
  }),
);
