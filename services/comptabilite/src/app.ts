import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { aujourdhuiMadagascar, creerGestionnaireErreurs, exigerCleInterne, journalRequetes, lireId } from "@hotel/commun";
import * as service from "./comptabilite.service.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

export const app = express();
app.use(helmet());
app.use(express.json());
app.use(journalRequetes(logger));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "comptabilite" });
});
app.use(exigerCleInterne(env.CLE_INTERNE));

const periode = z.object({ du: z.iso.date().optional(), au: z.iso.date().optional() });
app.get("/comptabilite/tableaux", async (req, res) => {
  const { du, au } = periode.parse(req.query);
  const fin = au ?? aujourdhuiMadagascar();
  res.json(await service.listerTableaux(du ?? `${fin.slice(0, 8)}01`, fin));
});
app.post("/comptabilite/tableaux/generer", async (req, res) => {
  const { jour } = z.object({ jour: z.iso.date().optional() }).parse(req.body ?? {});
  res.json(await service.genererTableau(jour));
});
app.get("/comptabilite/reversements", async (req, res) => {
  res.json(await service.listerReversements(z.object({ statut: z.enum(["A_REVERSER", "REVERSE"]).optional() }).parse(req.query).statut));
});
app.post("/comptabilite/reversements/:id/effectuer", async (req, res) => {
  res.json(await service.effectuerReversement(lireId(req)));
});
app.get("/comptabilite/factures", async (req, res) => {
  res.json(await service.listerCopies(z.object({ jour: z.iso.date().optional() }).parse(req.query).jour));
});

app.use(creerGestionnaireErreurs({ logger }));
