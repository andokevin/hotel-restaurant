import express from "express";
import helmet from "helmet";
import { creerGestionnaireErreurs, exigerCleInterne, journalRequetes } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { routeurFactures } from "./modules/facture/facture.routes.js";
import { routeurPaiements } from "./modules/paiement/paiement.routes.js";

export const app = express();

app.use(helmet());
app.use(express.json());
app.use(journalRequetes(logger));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "facturation" });
});

// Seule la gateway (ou un autre service) peut appeler facturation.
// Les notifications de Papi passent elles aussi par la gateway, qui ajoute la clé.
app.use(exigerCleInterne(env.CLE_INTERNE));

app.use("/factures", routeurFactures);
app.use("/paiements", routeurPaiements);

app.use(
  creerGestionnaireErreurs({
    logger,
    contraintes: {
      facture_pas_de_surpaiement: {
        status: 422,
        code: "MONTANT_SUPERIEUR_AU_RESTE",
        message: "Le montant dépasse le reste à payer",
      },
    },
  }),
);
