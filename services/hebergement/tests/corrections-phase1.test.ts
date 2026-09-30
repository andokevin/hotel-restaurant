import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { appel, creerCategorie, creerChambre, demandeReservation, RECEPTION, reserver, viderBase, viderFiles } from "./aide.js";

// Un test par bug de la section 1.3 du guide : s'il réapparaît, le test casse.
describe("Corrections de la phase 1", () => {
  beforeEach(async () => {
    await viderBase();
    await viderFiles();
  });
  afterAll(async () => {
    await bus.fermer();
    await prisma.$disconnect();
  });

  it("B2 — GET /categories renvoie bien la liste", async () => {
    await creerCategorie();
    const res = await appel("get", "/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].code).toBe("STANDARD");
  });

  it("B3 — la confirmation n'est pas accessible publiquement", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, "2030-10-10", "2030-10-12");

    expect((await appel("post", `/reservations/${r.body.id}/confirmer`)).status).toBe(404);
    expect((await request(app).post(`/interne/reservations/${r.body.id}/confirmer`)).status).toBe(401);
    expect(
      (await request(app).post(`/interne/reservations/${r.body.id}/confirmer`).set("x-cle-interne", "mauvaise-cle")).status,
    ).toBe(401);

    const ok = await appel("post", `/interne/reservations/${r.body.id}/confirmer`);
    expect(ok.status).toBe(200);
    expect(ok.body.statut).toBe("CONFIRMEE");
  });

  it("sans clé interne, même les routes « publiques » sont refusées (seule la gateway entre)", async () => {
    expect((await request(app).get("/categories")).status).toBe(401);
    expect((await request(app).get("/health")).status).toBe(200);
  });

  it("B3 — confirmer deux fois est sans effet (idempotence)", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, "2030-10-10", "2030-10-12");
    const confirmer = () => appel("post", `/interne/reservations/${r.body.id}/confirmer`);

    await confirmer();
    const second = await confirmer();

    expect(second.status).toBe(200);
    expect(second.body.version).toBe(2); // une seule incrémentation
  });

  it("I2 — un :id qui n'est pas un UUID donne 400, pas 500", async () => {
    const res = await appel("get", "/chambres/abc");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("I3 — un statut inconnu en filtre donne 400", async () => {
    expect((await appel("get", "/reservations?statut=PIRATE")).status).toBe(400);
    expect((await appel("get", "/reservations?statut=CONFIRMEE")).status).toBe(200);
  });

  it("I4 — les références sont uniques même en rafale", async () => {
    const cat = await creerCategorie();
    // Chambres créées l'une après l'autre : seule la création des réservations est concurrente.
    for (let n = 1; n <= 20; n++) await creerChambre(cat.id, String(200 + n));

    const reponses = await Promise.all(Array.from({ length: 20 }, () => reserver(cat.id, "2030-10-10", "2030-10-12")));

    const references = reponses.map((r) => r.body.reference as string);
    expect(reponses.every((r) => r.status === 201)).toBe(true);
    expect(new Set(references).size).toBe(20);
    expect(references.every((ref) => /^RES-\d{4}-\d{6}$/.test(ref))).toBe(true);
  });

  it("le montant est calculé par le serveur (2 nuits × 80 000 Ar)", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const res = await appel("post", "/reservations", RECEPTION).send({
      ...demandeReservation(cat.id, "2030-10-10", "2030-10-12"),
      montantTotal: 1,
    });

    expect(res.body.montantTotal).toBe(160_000);
  });
});
