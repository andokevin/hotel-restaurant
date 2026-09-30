import { randomBytes, randomUUID } from "node:crypto";
import express from "express";

// FAUX Papi.mg, pour le développement uniquement (aucune vraie transaction).
// Il imite l'API vérifiée dans Reclamia : POST /dashboard/api/payment-links (en-tête Token),
// puis une page de paiement qui envoie la notification au notificationUrl.
//
// Usage :
//   pnpm --filter @hotel/facturation faux-papi            (écoute sur http://localhost:4010)
//   puis, dans services/facturation/.env : PAPI_BASE_URL=http://localhost:4010
//                                          PUBLIC_URL=http://localhost:3000   (la gateway, sans tunnel)
const PORT = Number(process.env.PORT_FAUX_PAPI ?? 4010);

type Lien = {
  reference: string;
  amount: number;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  notificationToken: string;
  description: string;
};
const liens = new Map<string, Lien>();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post("/dashboard/api/payment-links", (req, res) => {
  if (!req.get("Token")) {
    res.status(401).json({ message: "Token manquant" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const id = randomUUID();
  const lien: Lien = {
    reference: String(b.reference),
    amount: Number(b.amount),
    notificationUrl: String(b.notificationUrl),
    successUrl: String(b.successUrl),
    failureUrl: String(b.failureUrl),
    notificationToken: randomBytes(16).toString("hex"),
    description: String(b.description ?? ""),
  };
  liens.set(id, lien);
  console.log(`[faux-papi] lien créé : ${lien.amount} Ar, référence ${lien.reference}`);
  res.json({
    data: {
      paymentLink: `http://localhost:${PORT}/payer/${id}`,
      notificationToken: lien.notificationToken,
      amount: lien.amount,
      currency: "MGA",
      paymentReference: lien.reference,
    },
  });
});

app.get("/payer/:id", (req, res) => {
  const lien = liens.get(req.params.id);
  if (!lien) {
    res.status(404).send("Lien inconnu");
    return;
  }
  res.send(`<!doctype html><meta charset="utf-8"><title>Faux Papi</title>
<body style="font-family:sans-serif;max-width:28rem;margin:3rem auto">
<h1>Faux Papi (développement)</h1>
<p>${lien.description}</p><p><strong>${lien.amount.toLocaleString("fr-FR")} Ar</strong></p>
<form method="post"><select name="methode"><option>MVOLA</option><option>AIRTEL_MONEY</option><option>ORANGE_MONEY</option></select>
<button name="issue" value="SUCCESS">Payer</button> <button name="issue" value="FAILED">Refuser</button></form></body>`);
});

// Le « client » a cliqué : on notifie le marchand (serveur à serveur), PUIS on redirige le navigateur.
app.post("/payer/:id", async (req, res) => {
  const lien = liens.get(req.params.id);
  if (!lien) {
    res.status(404).send("Lien inconnu");
    return;
  }
  const issue = req.body.issue === "FAILED" ? "FAILED" : "SUCCESS";
  const notification = {
    paymentStatus: issue,
    paymentMethod: String(req.body.methode ?? "MVOLA"),
    currency: "MGA",
    amount: lien.amount,
    fee: 0,
    merchantPaymentReference: lien.reference,
    paymentReference: randomUUID(),
    notificationToken: lien.notificationToken,
    message: issue === "SUCCESS" ? "Payment completed successfully." : "Paiement refusé (simulation)",
  };
  try {
    const r = await fetch(lien.notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });
    console.log(`[faux-papi] notification ${issue} envoyée → ${r.status}`);
  } catch (err) {
    console.error("[faux-papi] notification impossible :", err);
  }
  res.redirect(issue === "SUCCESS" ? lien.successUrl : lien.failureUrl);
});

app.listen(PORT, () => console.log(`[faux-papi] http://localhost:${PORT}`));
