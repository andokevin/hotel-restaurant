import { Router } from "express";
import * as controller from "./paiement.controller.js";

export const routeurPaiements = Router();

routeurPaiements.post("/", controller.demander);
routeurPaiements.post("/notification", controller.notification); // Papi (route PUBLIQUE dans la gateway)
routeurPaiements.get("/anomalies", controller.anomalies); // AVANT "/:id", sinon "anomalies" serait pris pour un id
routeurPaiements.get("/:id", controller.detail);
routeurPaiements.post("/:id/retour", controller.retour); // le client revient de Papi (#69)
routeurPaiements.post("/:id/rembourse", controller.rembourse); // anomalie remboursée (#68)
routeurPaiements.post("/:id/accepter", controller.accepter); // anomalie acceptée (#68)
