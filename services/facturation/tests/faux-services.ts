import type { AddressInfo } from "node:net";
import express from "express";

// Faux Papi et faux hebergement, démarrés AVANT que l'app lise sa configuration.
// Les tests pilotent leur comportement et lisent ce qu'ils ont reçu via `faux`.

type DemandePapi = { token: string | undefined; corps: Record<string, unknown> };

export const faux = {
  papi: { demandes: [] as DemandePapi[], enPanne: false },
  reservations: new Map<string, Record<string, unknown>>(),
  reinitialiser() {
    this.papi.demandes = [];
    this.papi.enPanne = false;
    this.reservations.clear();
  },
};

const papi = express().use(express.json());
papi.post("/dashboard/api/payment-links", (req, res) => {
  faux.papi.demandes.push({ token: req.get("Token"), corps: req.body });
  if (faux.papi.enPanne) {
    res.status(503).json({ message: "Papi en maintenance" });
    return;
  }
  const reference = String(req.body.reference);
  res.json({
    data: {
      paymentLink: `https://papi.test/payer/${reference}`,
      notificationToken: `jeton-papi-${reference}`,
      amount: req.body.amount,
      currency: "MGA",
    },
  });
});

const hebergement = express();
hebergement.get("/interne/reservations/:id", (req, res) => {
  if (req.get("x-cle-interne") !== process.env.CLE_INTERNE) {
    res.status(401).end();
    return;
  }
  const r = faux.reservations.get(req.params.id);
  if (r) res.json(r);
  else res.status(404).json({ code: "NOT_FOUND" });
});

const demarrer = (app: express.Express) =>
  new Promise<string>((ok) => {
    const s = app.listen(0, () => ok(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
    s.unref(); // ne retient pas le processus à la fin des tests
  });

process.env.PAPI_BASE_URL = await demarrer(papi);
process.env.HEBERGEMENT_URL = await demarrer(hebergement);
