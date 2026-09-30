import type { Server } from "node:http";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { demarrerServiceEcho, ID_UTILISATEUR, jeton } from "./aide.js";

// Les faux services doivent tourner AVANT de charger la gateway : env.ts lit leurs adresses à l'import.
const auth = await demarrerServiceEcho("auth");
const hebergement = await demarrerServiceEcho("hebergement");
process.env.AUTH_URL = auth.url;
process.env.HEBERGEMENT_URL = hebergement.url;
const { app } = await import("../src/app.js");

const fermer = (s: Server) => new Promise((ok) => s.close(ok));
afterAll(async () => {
  await fermer(auth.serveur);
  await fermer(hebergement.serveur);
});

const avecJeton = async (req: request.Test, role: Parameters<typeof jeton>[0]["role"]) =>
  req.set("Authorization", `Bearer ${await jeton({ role })}`);

describe("Routage", () => {
  it("transmet une route publique au bon service, sans /api, avec la clé interne", async () => {
    const res = await request(app).get("/api/categories?tri=prix");

    expect(res.status).toBe(200);
    expect(res.body.service).toBe("hebergement");
    expect(res.body.chemin).toBe("/categories?tri=prix");
    expect(res.body.cleInterne).toBe(process.env.CLE_INTERNE);
    expect(res.body.role).toBeNull(); // visiteur anonyme
  });

  it("transmet le corps JSON intact (aucun express.json() avant le proxy)", async () => {
    const res = await request(app)
      .post("/api/auth/connexion")
      .send({ email: "rakoto@mail.mg", motDePasse: "Tsara-Be-2026!" });

    expect(res.status).toBe(401); // le faux auth refuse toute connexion
    expect(res.body.service).toBe("auth");
    expect(res.body.corps).toEqual({ email: "rakoto@mail.mg", motDePasse: "Tsara-Be-2026!" });
  });
});

describe("Refus par défaut", () => {
  it("une route absente de la table des droits répond 404, même si le service la connaît", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    expect((await request(app).get("/api/n-existe-pas")).status).toBe(404);
    expect((await request(app).post(`/api/reservations/${id}/confirmer`)).status).toBe(404);
    expect((await request(app).post(`/api/interne/reservations/${id}/confirmer`)).status).toBe(404);
    // Bonne route, mauvaise méthode : refusée aussi
    expect((await request(app).delete("/api/categories")).status).toBe(404);
  });
});

describe("Authentification", () => {
  it("route protégée sans jeton : 401", async () => {
    const res = await request(app).get("/api/reservations");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NON_AUTORISE");
  });

  it("jeton expiré, mal signé ou destiné à une autre application : 401", async () => {
    const expire = await jeton({ role: "RECEPTIONNISTE", expireDans: Math.floor(Date.now() / 1000) - 60 });
    const autreAudience = await jeton({ role: "RECEPTIONNISTE", audience: "autre-application" });
    const falsifie = `${(await jeton({ role: "CLIENT" })).slice(0, -4)}AAAA`;

    for (const j of [expire, autreAudience, falsifie, "pas-un-jwt"]) {
      expect((await request(app).get("/api/reservations").set("Authorization", `Bearer ${j}`)).status).toBe(401);
    }
  });

  it("un jeton expiré n'empêche pas de consulter une route publique", async () => {
    const expire = await jeton({ role: "CLIENT", expireDans: Math.floor(Date.now() / 1000) - 60 });
    expect((await request(app).get("/api/categories").set("Authorization", `Bearer ${expire}`)).status).toBe(200);
  });

  it("transmet l'identité vérifiée au service", async () => {
    const res = await avecJeton(request(app).get("/api/reservations"), "RECEPTIONNISTE");

    expect(res.status).toBe(200);
    expect(res.body.utilisateurId).toBe(ID_UTILISATEUR);
    expect(res.body.role).toBe("RECEPTIONNISTE");
  });
});

describe("Autorisation par rôle", () => {
  it("mauvais rôle : 403, et la requête n'atteint jamais le service", async () => {
    const res = await avecJeton(request(app).get("/api/reservations"), "CLIENT");
    expect(res.status).toBe(403);
    expect(res.body.service).toBeUndefined();

    expect((await avecJeton(request(app).get("/api/auth/utilisateurs"), "RECEPTIONNISTE")).status).toBe(403);
    expect((await avecJeton(request(app).get("/api/auth/utilisateurs"), "ADMIN")).status).toBe(200);
  });

  it("un client ne peut pas se déclarer ADMIN en forgeant les en-têtes", async () => {
    const res = await request(app)
      .get("/api/auth/moi")
      .set("Authorization", `Bearer ${await jeton({ role: "CLIENT" })}`)
      .set("x-utilisateur-role", "ADMIN")
      .set("x-cle-interne", "je-devine-la-cle");

    expect(res.body.role).toBe("CLIENT"); // l'en-tête forgé a été remplacé
    expect(res.body.cleInterne).toBe(process.env.CLE_INTERNE);

    const admin = await request(app).get("/api/auth/utilisateurs").set("x-utilisateur-role", "ADMIN");
    expect(admin.status).toBe(401); // sans jeton, l'en-tête forgé ne sert à rien
  });
});

describe("Réservations : ordre des règles", () => {
  it("un CLIENT n'atteint pas /reservations/departs par la règle /reservations/:id", async () => {
    expect((await avecJeton(request(app).get("/api/reservations/departs"), "CLIENT")).status).toBe(403);
    expect((await avecJeton(request(app).get("/api/reservations/departs"), "RECEPTIONNISTE")).status).toBe(200);
    expect((await avecJeton(request(app).get("/api/reservations/mes-reservations"), "CLIENT")).status).toBe(200);
    expect((await avecJeton(request(app).get("/api/reservations/mes-reservations"), "RECEPTIONNISTE")).status).toBe(403);
  });

  it("check-in, check-out et annulation réservés à la réception", async () => {
    const id = "7b1f3c2a-9d4e-4f5a-8b6c-1d2e3f4a5b6c";
    for (const action of ["check-in", "check-out", "annuler"]) {
      expect((await avecJeton(request(app).post(`/api/reservations/${id}/${action}`), "CLIENT")).status).toBe(403);
      expect((await avecJeton(request(app).post(`/api/reservations/${id}/${action}`), "RECEPTIONNISTE")).status).toBe(200);
    }
  });
});

describe("Protection contre la force brute", () => {
  it("les connexions RÉUSSIES ne comptent pas (tout le personnel partage l'IP de l'hôtel)", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post("/api/auth/connexion").send({ email: `employe${i}@hotel.mg`, motDePasse: "bon" });
      expect(res.status).toBe(200);
    }
  });

  it("au-delà de la limite d'ÉCHECS, la connexion répond 429", async () => {
    // LIMITE_CONNEXIONS = 3 en test ; le test « corps JSON intact » a déjà consommé un échec
    const statuts: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuts.push((await request(app).post("/api/auth/connexion").send({ email: "x@y.mg", motDePasse: "z" })).status);
    }
    expect(statuts.at(-1)).toBe(429);
    // Les autres routes ne sont pas limitées
    expect((await request(app).get("/api/categories")).status).toBe(200);
  });
});

describe("Service en panne", () => {
  it("répond 502 proprement si le service est injoignable", async () => {
    await fermer(hebergement.serveur);
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("SERVICE_INDISPONIBLE");
  });
});
