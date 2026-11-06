import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import {
  appel,
  creerCategorie,
  creerChambre,
  demandeReservation,
  evenementsOutbox,
  RECEPTION,
  reserver,
  viderBase,
  viderFiles,
} from "./aide.js";

describe("Nombre de personnes et capacité", () => {
  let categorieId: string;

  beforeEach(async () => {
    await viderBase();
    await viderFiles();
    categorieId = (await creerCategorie()).id; // capacité 2 (voir aide.ts)
    await creerChambre(categorieId, "101"); // une chambre doit exister pour pouvoir réserver
  });

  afterAll(async () => {
    await bus.fermer();
    await prisma.$disconnect();
  });

  // Une réservation valide, avec en plus les champs donnés (spread : le dernier gagne).
  const reserverAvec = (personnes: { nbAdultes?: number; nbEnfants?: number }) =>
    appel("post", "/reservations", RECEPTION).send({
      ...demandeReservation(categorieId, "2030-10-10", "2030-10-13"),
      ...personnes,
    });

  it("la base refuse une réservation avec 0 adulte (CHECK)", async () => {
    // 1. Une vraie réservation, créée par l'API (reserver = POST /reservations)
    const res = await reserver(categorieId, "2030-10-10", "2030-10-13");
    expect(res.status).toBe(201); // garde-fou : si la création échoue, on le sait tout de suite

    // 2. On contourne l'API et on écrit DIRECTEMENT en base : seul le CHECK peut nous arrêter
    const ecriture = prisma.reservation.update({
      where: { id: res.body.id },
      data: { nbAdultes: 0 },
    }); // pas de await : on garde la promesse pour la donner à expect

    // 3. La promesse doit échouer, ET à cause de NOTRE contrainte (son nom est dans le message)
    await expect(ecriture).rejects.toThrow(/reservation_nb_adultes_min/);
  });

  it("sans les champs : 1 adulte et 0 enfant par défaut (compatibilité avec le front actuel)", async () => {
    const res = await reserverAvec({});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nbAdultes: 1, nbEnfants: 0 });
  });

  type CasInvalide = { personnes: { nbAdultes?: number; nbEnfants?: number }; champ: string };
  it.each<CasInvalide>([
    { personnes: { nbAdultes: 0 }, champ: "nbAdultes" },
    { personnes: { nbEnfants: -1 }, champ: "nbEnfants" },
    { personnes: { nbAdultes: 1.5 }, champ: "nbAdultes" },
  ])("refuse $personnes (400 sur $champ)", async ({ personnes, champ }) => {
    const res = await reserverAvec(personnes);

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ champ }));
  });

  it("refuse 2 adultes + 1 enfant pour une capacité de 2 (422), sans rien créer", async () => {
    const res = await reserverAvec({ nbAdultes: 2, nbEnfants: 1 });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/3 personnes/);
    expect(await prisma.reservation.count()).toBe(0);
    expect(await evenementsOutbox()).toHaveLength(0);
  });

  it("accepte 2 adultes pour une capacité de 2, et renvoie les deux champs", async () => {
    const res = await reserverAvec({ nbAdultes: 2, nbEnfants: 0 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nbAdultes: 2, nbEnfants: 0 });
  });

  it("l'événement reservation.creee contient le nombre de personnes", async () => {
    await reserverAvec({ nbAdultes: 1, nbEnfants: 1 });

    const [evt] = await evenementsOutbox("reservation.creee");
    expect(evt?.payload).toMatchObject({ nbAdultes: 1, nbEnfants: 1 });
  });

  describe("GET /categories?personnes=", () => {
    beforeEach(async () => {
      await prisma.categorieChambre.create({
        data: { code: "SUITE_SENIOR", libelle: { fr: "Suite" }, capacite: 4, tarifNuit: 150_000 },
      });
    });

    it("ne garde que les catégories assez grandes", async () => {
      const res = await appel("get", "/categories?personnes=3");

      expect(res.status).toBe(200);
      expect(res.body.map((c: { code: string }) => c.code)).toEqual(["SUITE_SENIOR"]);
    });

    it("sans filtre : toutes les catégories", async () => {
      const res = await appel("get", "/categories");

      expect(res.body).toHaveLength(2);
    });

    it("refuse un nombre de personnes invalide (400)", async () => {
      const res = await appel("get", "/categories?personnes=zero");

      expect(res.status).toBe(400);
    });
  });
});
