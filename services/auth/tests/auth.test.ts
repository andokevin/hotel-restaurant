import request from "supertest";
import { importSPKI, jwtVerify } from "jose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { JWT_AUDIENCE, JWT_EMETTEUR } from "@hotel/commun";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { appel, cookieSession, creerCompte, MOT_DE_PASSE, viderBase } from "./aide.js";

const clePublique = () =>
  importSPKI(Buffer.from(process.env.JWT_CLE_PUBLIQUE_TEST ?? "", "base64").toString("utf8"), "EdDSA");

const connexion = (identifiant: string, motDePasse = MOT_DE_PASSE) =>
  appel("post", "/auth/connexion").send({ identifiant, motDePasse });

beforeEach(() => viderBase());
afterAll(() => prisma.$disconnect());

describe("Clé interne", () => {
  it("refuse toute route sans clé interne (seule la gateway peut appeler auth)", async () => {
    expect((await request(app).post("/auth/connexion").send({})).status).toBe(401);
    expect((await request(app).get("/health")).status).toBe(200);
  });
});

describe("Inscription", () => {
  it("crée un CLIENT, même si le corps demande ADMIN, sans exposer le hash", async () => {
    const res = await appel("post", "/auth/inscription").send({
      nom: "Rakoto Jean",
      telephone: "+261 34 12 345 67",
      email: "  Rakoto@Mail.MG ",
      motDePasse: MOT_DE_PASSE,
      role: "ADMIN",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("CLIENT");
    expect(res.body.telephone).toBe("0341234567"); // normalisé
    expect(res.body.email).toBe("rakoto@mail.mg");
    expect(res.body.langue).toBe("FR");
    expect(res.body).not.toHaveProperty("motDePasseHash");

    const enBase = await prisma.utilisateur.findUniqueOrThrow({ where: { telephone: "0341234567" } });
    expect(enBase.motDePasseHash).toMatch(/^scrypt\$1024\$8\$1\$/);
    expect(enBase.motDePasseHash).not.toContain(MOT_DE_PASSE);
  });

  it("l'email est obligatoire (reçus et notifications)", async () => {
    const res = await appel("post", "/auth/inscription").send({ nom: "Hanta", telephone: "0331234567", motDePasse: MOT_DE_PASSE });
    expect(res.status).toBe(400);
    expect(res.body.details[0].champ).toBe("email");
  });

  it("refuse un numéro déjà utilisé, même écrit autrement (409)", async () => {
    await creerCompte("0341234567");
    const doublon = await appel("post", "/auth/inscription").send({
      nom: "Autre",
      telephone: "034 12 345 67",
      email: "autre@mail.mg",
      motDePasse: MOT_DE_PASSE,
    });
    expect(doublon.status).toBe(409);
    expect(doublon.body.code).toBe("TELEPHONE_DEJA_UTILISE");
  });

  it("refuse un email déjà utilisé (409), un numéro invalide et un mot de passe trop court (400)", async () => {
    await creerCompte("0341234567", "CLIENT", true, "rakoto@mail.mg");
    const email = await appel("post", "/auth/inscription").send({
      nom: "Autre",
      telephone: "0321234567",
      email: "RAKOTO@mail.mg",
      motDePasse: MOT_DE_PASSE,
    });
    expect(email.status).toBe(409);
    expect(email.body.code).toBe("EMAIL_DEJA_UTILISE");

    const numero = await appel("post", "/auth/inscription").send({
      nom: "X",
      telephone: "0201234567",
      email: "x@mail.mg",
      motDePasse: MOT_DE_PASSE,
    });
    expect(numero.status).toBe(400);

    const court = await appel("post", "/auth/inscription").send({
      nom: "Court",
      telephone: "0381234567",
      email: "court@mail.mg",
      motDePasse: "123",
    });
    expect(court.status).toBe(400);
  });
});

describe("Connexion", () => {
  it("par téléphone (toutes écritures) ou par email", async () => {
    await creerCompte("0341234567", "CLIENT", true, "rakoto@mail.mg");

    for (const identifiant of ["0341234567", "+261 34 12 345 67", "034 12 345 67", "Rakoto@mail.mg"]) {
      expect((await connexion(identifiant)).status).toBe(200);
    }
  });

  it("renvoie un JWT signé valable 15 min et pose un cookie httpOnly", async () => {
    const u = await creerCompte("0341234567", "RECEPTIONNISTE");

    const res = await connexion("0341234567");

    expect(res.status).toBe(200);
    const { payload } = await jwtVerify(res.body.jetonAcces, await clePublique(), {
      issuer: JWT_EMETTEUR,
      audience: JWT_AUDIENCE,
    });
    expect(payload.sub).toBe(u.id);
    expect(payload.role).toBe("RECEPTIONNISTE");
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);

    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/auth");
    expect(res.body).not.toHaveProperty("jetonSession"); // le jeton de session n'est QUE dans le cookie
  });

  it("même réponse pour un compte inconnu et un mauvais mot de passe", async () => {
    await creerCompte("0341234567", "CLIENT", true, "rakoto@mail.mg");

    const inconnu = await connexion("0349999999");
    const emailInconnu = await connexion("personne@mail.mg");
    const mauvais = await connexion("0341234567", "mauvais-mdp");

    expect([inconnu.status, emailInconnu.status, mauvais.status]).toEqual([401, 401, 401]);
    expect(inconnu.body).toEqual(mauvais.body);
    expect(emailInconnu.body).toEqual(mauvais.body);
  });

  it("refuse un compte désactivé (403), seulement après un mot de passe correct", async () => {
    await creerCompte("0341234567", "RECEPTIONNISTE", false);

    expect((await connexion("0341234567", "faux-faux-faux")).status).toBe(401);
    const res = await connexion("0341234567");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPTE_DESACTIVE");
  });
});

describe("Rafraîchissement (rotation des jetons)", () => {
  const connecter = async () => {
    await creerCompte("0341234567");
    return cookieSession(await connexion("0341234567"));
  };

  it("échange le cookie contre un nouveau jeton d'accès et un NOUVEAU cookie", async () => {
    const cookie = await connecter();

    const res = await appel("post", "/auth/rafraichir").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.jetonAcces).toBeTypeOf("string");
    expect(cookieSession(res)).not.toBe(cookie);
  });

  it("un jeton déjà utilisé révèle un vol : TOUTES les sessions sont coupées", async () => {
    const vole = await connecter();
    const nouveau = cookieSession(await appel("post", "/auth/rafraichir").set("Cookie", vole));

    // L'attaquant rejoue l'ancien jeton…
    expect((await appel("post", "/auth/rafraichir").set("Cookie", vole)).status).toBe(401);
    // …et la session légitime est coupée aussi : l'utilisateur doit se reconnecter.
    expect((await appel("post", "/auth/rafraichir").set("Cookie", nouveau)).status).toBe(401);
  });

  it("après déconnexion, le cookie ne sert plus à rien", async () => {
    const cookie = await connecter();

    expect((await appel("post", "/auth/deconnexion").set("Cookie", cookie)).status).toBe(204);
    expect((await appel("post", "/auth/rafraichir").set("Cookie", cookie)).status).toBe(401);
  });

  it("sans cookie : 401", async () => {
    expect((await appel("post", "/auth/rafraichir")).status).toBe(401);
  });
});

describe("Profil et gestion des comptes", () => {
  it("GET /auth/moi lit l'identité transmise par la gateway", async () => {
    const u = await creerCompte("0341234567");

    const res = await appel("get", "/auth/moi", { id: u.id, role: "CLIENT" });
    expect(res.status).toBe(200);
    expect(res.body.telephone).toBe("0341234567");

    expect((await appel("get", "/auth/moi")).status).toBe(401);
  });

  it("seul un ADMIN gère les comptes (vérifié aussi dans le service)", async () => {
    const client = await creerCompte("0341234567");
    const admin = await creerCompte("0340000001", "ADMIN");
    const nouveau = { nom: "Hanta", telephone: "0381234567", email: "hanta@hotel.mg", motDePasse: MOT_DE_PASSE, role: "FEMME_MENAGE" };

    expect((await appel("post", "/auth/utilisateurs", { id: client.id, role: "CLIENT" }).send(nouveau)).status).toBe(403);

    const res = await appel("post", "/auth/utilisateurs", { id: admin.id, role: "ADMIN" }).send(nouveau);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("FEMME_MENAGE");
  });

  it("désactiver un compte coupe ses sessions", async () => {
    const admin = await creerCompte("0340000001", "ADMIN");
    const recep = await creerCompte("0341234567", "RECEPTIONNISTE");
    const cookie = cookieSession(await connexion("0341234567"));

    const res = await appel("patch", `/auth/utilisateurs/${recep.id}`, { id: admin.id, role: "ADMIN" }).send({ actif: false });

    expect(res.status).toBe(200);
    expect((await appel("post", "/auth/rafraichir").set("Cookie", cookie)).status).toBe(401);
  });
});
