import type { AddressInfo } from "node:net";
import express from "express";

// Faux hebergement (nuitées vendues par nuit) et faux stock (sorties MENAGE du jour).
export const faux = {
  nuitees: new Map<string, number>(),
  sorties: [] as { code: string; consommationParNuitee: number; quantite: number }[],
};

const hebergement = express();
hebergement.get("/interne/reservations/statistiques", (req, res) => {
  const n = faux.nuitees.get(String(req.query.jour)) ?? 0;
  res.json({ jour: req.query.jour, nuiteesVendues: n, repartitionCanaux: n ? { SITE_WEB: n } : {} });
});
const stock = express();
stock.get("/interne/sorties-menage", (_req, res) => void res.json(faux.sorties));

const demarrer = (app: express.Express) =>
  new Promise<string>((ok) => {
    const s = app.listen(0, () => ok(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
    s.unref();
  });
process.env.HEBERGEMENT_URL = await demarrer(hebergement);
process.env.STOCK_URL = await demarrer(stock);
