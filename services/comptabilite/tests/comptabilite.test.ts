import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { aujourdhuiMadagascar, type ContenuEvenement, type Enveloppe } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { traiterFactureCloturee } from "../src/comptabilite.service.js";
import { prisma } from "../src/db.js";
import { faux } from "./faux-services.js";

const appel = (methode: "get" | "post", chemin: string) =>
  request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "").set("x-utilisateur-id", randomUUID()).set("x-utilisateur-role", "COMPTABLE");

const facture = (type: "SEJOUR" | "RESTAURANT", lignes: ContenuEvenement<"facture.cloturee">["lignes"]): Enveloppe<"facture.cloturee"> => ({
  id: randomUUID(),
  type: "facture.cloturee",
  emisLe: new Date().toISOString(),
  payload: {
    factureId: randomUUID(),
    numero: "FAC-2026-000010",
    type,
    reservationId: type === "SEJOUR" ? randomUUID() : null,
    commandeId: type === "RESTAURANT" ? randomUUID() : null,
    clientNom: "Rakoto Jean",
    montantTotal: lignes.reduce((s, l) => s + l.montant, 0),
    montantPaye: lignes.reduce((s, l) => s + l.montant, 0),
    emiseLe: new Date().toISOString(),
    clotureeLe: new Date().toISOString(),
    lignes,
  },
});
const HEB = { libelle: "Suite – 2 nuits", quantite: 2, prixUnitaire: 150_000, montant: 300_000, origine: "HEBERGEMENT" as const };
const RESTO = { libelle: "Restaurant CMD-7", quantite: 1, prixUnitaire: 43_000, montant: 43_000, origine: "RESTAURANT" as const };

beforeEach(async () => {
  faux.nuitees.clear();
  faux.sorties = [];
  await prisma.$executeRawUnsafe("TRUNCATE copie_facture, statistique_journaliere, controle_stock_journalier, reversement, evenement_traite, outbox_evenement");
});
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

describe("Copie de facture et reversement de la part restaurant", () => {
  it("séjour avec consommations restaurant : copie + reversement de 43 000 Ar, une seule fois", async () => {
    const evt = facture("SEJOUR", [HEB, RESTO]);
    await traiterFactureCloturee(evt);
    await traiterFactureCloturee(evt);

    expect(await prisma.copieFacture.count()).toBe(1);
    const r = await appel("get", "/comptabilite/reversements?statut=A_REVERSER");
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ montant: 43_000, statut: "A_REVERSER" });

    expect((await appel("post", `/comptabilite/reversements/${r.body[0].id}/effectuer`)).body.statut).toBe("REVERSE");
    expect((await appel("post", `/comptabilite/reversements/${r.body[0].id}/effectuer`)).status).toBe(422);
  });

  it("facture RESTAURANT (encaissée au restaurant) : rien à reverser", async () => {
    await traiterFactureCloturee(facture("RESTAURANT", [RESTO]));
    expect(await prisma.reversement.count()).toBe(0);
  });
});

describe("Tableau de bord de 23 h", () => {
  it("compte les factures du jour, le CA par origine, et détecte l'écart de stock", async () => {
    await traiterFactureCloturee(facture("SEJOUR", [HEB, RESTO]));
    await traiterFactureCloturee(facture("RESTAURANT", [RESTO]));
    const jour = aujourdhuiMadagascar();
    const hier = new Date(`${jour}T00:00:00Z`);
    hier.setUTCDate(hier.getUTCDate() - 1);
    faux.nuitees.set(jour, 3);
    faux.nuitees.set(hier.toISOString().slice(0, 10), 4); // 4 chambres occupées la nuit dernière
    faux.sorties = [
      { code: "GEL_DOUCHE", consommationParNuitee: 1, quantite: 4 }, // conforme
      { code: "PANTOUFLE", consommationParNuitee: 1, quantite: 6 }, // 2 de trop : écart
    ];

    const t = (await appel("post", "/comptabilite/tableaux/generer").send({})).body;

    expect(t).toMatchObject({ jour, nuiteesVendues: 3, nombreFactures: 2, caHebergement: 300_000, caRestaurant: 86_000, ecartDetecte: true });
    expect(t.controles).toEqual([
      { articleCode: "GEL_DOUCHE", consommationAttendue: 4, consommationReelle: 4, ecart: 0 },
      { articleCode: "PANTOUFLE", consommationAttendue: 4, consommationReelle: 6, ecart: 2 },
    ]);

    // Recalculable : relancer ne crée pas de doublon
    await appel("post", "/comptabilite/tableaux/generer").send({ jour });
    expect(await prisma.controleStockJournalier.count()).toBe(2);
    expect((await appel("get", "/comptabilite/tableaux")).body).toHaveLength(1);
  });
});
