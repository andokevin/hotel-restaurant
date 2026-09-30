import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { appel, creerChambre, demandeReservation, viderBase } from "./aide.js";

// Ces tests passent par l'API HTTP ET par la vraie contrainte PostgreSQL :
// c'est la base qui refuse le chevauchement, pas le code TypeScript.
describe("Anti-surbooking (contrainte EXCLUDE reservation_sans_chevauchement)", () => {
  let chambreId: string;

  beforeEach(async () => {
    await viderBase();
    chambreId = (await creerChambre()).id;
  });

  afterAll(() => prisma.$disconnect());

  const reserver = (arrivee: string, depart: string) =>
    appel("post", "/reservations").send(demandeReservation(chambreId, arrivee, depart));

  it("refuse une réservation qui chevauche une réservation active (409)", async () => {
    expect((await reserver("2030-10-10", "2030-10-13")).status).toBe(201);

    const res = await reserver("2030-10-12", "2030-10-15");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CHAMBRE_INDISPONIBLE");
  });

  it("accepte une arrivée le jour du départ précédent (intervalle '[)')", async () => {
    expect((await reserver("2030-10-10", "2030-10-13")).status).toBe(201);
    expect((await reserver("2030-10-13", "2030-10-15")).status).toBe(201);
  });

  it("une réservation annulée ne bloque plus la chambre", async () => {
    const premiere = await reserver("2030-10-10", "2030-10-13");
    await prisma.reservation.update({ where: { id: premiere.body.id }, data: { statut: "ANNULEE" } });

    expect((await reserver("2030-10-11", "2030-10-12")).status).toBe(201);
  });

  it("deux demandes simultanées sur les mêmes dates : une seule réussit", async () => {
    const [a, b] = await Promise.all([reserver("2030-10-10", "2030-10-13"), reserver("2030-10-10", "2030-10-13")]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("la même période sur une autre chambre est acceptée", async () => {
    const autre = await creerChambre("102");
    expect((await reserver("2030-10-10", "2030-10-13")).status).toBe(201);

    const res = await appel("post", "/reservations").send(demandeReservation(autre.id, "2030-10-10", "2030-10-13"));
    expect(res.status).toBe(201);
  });
});
