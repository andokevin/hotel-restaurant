import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express from "express";

// Faux hebergement (séjours en cours par chambre) et fausse facturation (factures reçues).
export const faux = {
  sejours: new Map<string, { id: string; reference: string; clientNom: string; chambre: { numero: string } }>(),
  factures: [] as Record<string, unknown>[],
  reinitialiser() {
    this.sejours.clear();
    this.factures = [];
  },
};

const hebergement = express();
hebergement.get("/interne/reservations/en-cours", (req, res) => {
  const s = faux.sejours.get(String(req.query.chambre));
  if (s) res.json(s);
  else res.status(404).json({ code: "NOT_FOUND" });
});

const facturation = express().use(express.json());
facturation.post("/interne/factures/restaurant", (req, res) => {
  faux.factures.push(req.body);
  const lignes = req.body.lignes as { quantite: number; prixUnitaire: number }[];
  res.status(201).json({ id: randomUUID(), numero: "FAC-2026-000099", montantTotal: lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0) });
});

const demarrer = (app: express.Express) =>
  new Promise<string>((ok) => {
    const s = app.listen(0, () => ok(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
    s.unref();
  });

process.env.HEBERGEMENT_URL = await demarrer(hebergement);
process.env.FACTURATION_URL = await demarrer(facturation);
