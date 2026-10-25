import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { appel, creerCategorie, creerChambre, jour, RECEPTION, reserver, viderBase, viderFiles } from "./aide.js";

beforeEach(async () => {
  await viderBase();
  await viderFiles();
});
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

describe("Détail des nuitées", () => {
  it("chaque nuit a son prix et le nom de sa saison ; la somme des nuits = le total", async () => {
    // Préparer : une catégorie à 80 000 Ar, une chambre, et une saison « Fêtes » sur la 1re nuit seulement
    const categorie = await creerCategorie("STANDARD", 80_000);
    await creerChambre(categorie.id, "101");
    await prisma.saison.create({
      data: {
        nom: { fr: "Fêtes" },
        dateDebut: new Date(`${jour(10)}T00:00:00Z`),
        dateFin: new Date(`${jour(10)}T00:00:00Z`),
        tarifs: { create: { categorieId: categorie.id, tarifNuit: 120_000 } },
      },
    });
    const creation = await reserver(categorie.id, jour(10), jour(12)); // 2 nuits : jour 10 et jour 11

    // Agir : la réception lit le détail de la réservation
    const res = await appel("get", `/reservations/${creation.body.id}`, RECEPTION);

    // Vérifier : prix et saison de chaque nuit, puis la somme
    expect(res.status).toBe(200);
    const [nuit1, nuit2] = res.body.nuitees;
    expect(nuit1).toMatchObject({ tarifApplique: 120_000, saison: { nom: { fr: "Fêtes" } } });
    expect(nuit2).toMatchObject({ tarifApplique: 80_000, saison: null });
    const somme = res.body.nuitees.reduce((total: number, n: { tarifApplique: number }) => total + n.tarifApplique, 0);
    expect(somme).toBe(res.body.montantTotal);
  });
});
