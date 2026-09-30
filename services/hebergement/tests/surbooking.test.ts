import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { creerCategorie, creerChambre, reserver, viderBase, viderFiles } from "./aide.js";

// Ces tests passent par l'API HTTP ET par la vraie contrainte PostgreSQL :
// c'est la base qui refuse le chevauchement, pas le code TypeScript.
describe("Anti-surbooking", () => {
  let categorieId: string;

  beforeEach(async () => {
    await viderBase();
    await viderFiles();
    categorieId = (await creerCategorie()).id;
  });

  afterAll(async () => {
    await bus.fermer();
    await prisma.$disconnect();
  });

  it("catégorie d'une seule chambre : le chevauchement est refusé (409)", async () => {
    await creerChambre(categorieId, "101");
    expect((await reserver(categorieId, "2030-10-10", "2030-10-13")).status).toBe(201);

    const res = await reserver(categorieId, "2030-10-12", "2030-10-15");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("AUCUNE_CHAMBRE_DISPONIBLE");
  });

  it("accepte une arrivée le jour du départ précédent (intervalle '[)')", async () => {
    await creerChambre(categorieId, "101");
    expect((await reserver(categorieId, "2030-10-10", "2030-10-13")).status).toBe(201);
    expect((await reserver(categorieId, "2030-10-13", "2030-10-15")).status).toBe(201);
  });

  it("une réservation annulée ne bloque plus la chambre", async () => {
    await creerChambre(categorieId, "101");
    const premiere = await reserver(categorieId, "2030-10-10", "2030-10-13");
    await prisma.reservation.update({ where: { id: premiere.body.id }, data: { statut: "ANNULEE" } });

    expect((await reserver(categorieId, "2030-10-11", "2030-10-12")).status).toBe(201);
  });

  it("la contrainte EXCLUDE tient même si on écrit directement en base", async () => {
    const chambre = await creerChambre(categorieId, "101");
    const r = await reserver(categorieId, "2030-10-10", "2030-10-13");
    expect(r.status).toBe(201);

    // Contourne l'API : c'est PostgreSQL lui-même qui doit refuser
    const doublon = prisma.reservation.create({
      data: {
        reference: "RES-TEST-DOUBLON",
        chambreId: chambre.id,
        clientNom: "Intrus",
        clientTelephone: "0340000000",
        pieceIdentiteType: "CIN",
        pieceIdentiteNumero: "0000",
        dateArrivee: new Date("2030-10-11"),
        dateDepart: new Date("2030-10-12"),
        montantTotal: 1,
        canal: "RECEPTION",
      },
    });
    await expect(doublon).rejects.toThrow(/reservation_sans_chevauchement/);
  });
});
