import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { obtenirFactureSejour, traiterConsommationImputee, traiterReservationCreee } from "../src/modules/facture/facture.service.js";
import { enveloppe, exposerReservation, nuitees, reservationCreee, toutReinitialiser } from "./aide.js";

beforeEach(() => toutReinitialiser());
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

// Lignes de la facture d'une réservation, dans l'ordre de la facture
const lignes = async (reservationId: string) => {
  const f = await prisma.facture.findUniqueOrThrow({
    where: { reservationId },
    include: { lignes: { orderBy: [{ origine: "asc" }, { ordre: "asc" }] } },
  });
  return f.lignes;
};

// Ce qui doit être identique, quel que soit le chemin de création
const essentiel = (l: { libelle: string; quantite: number; prixUnitaire: number; montant: number; ordre: number }) => ({
  libelle: l.libelle,
  quantite: l.quantite,
  prixUnitaire: l.prixUnitaire,
  montant: l.montant,
  ordre: l.ordre,
});

describe("Facture de séjour : une ligne par groupe de nuitées (#73)", () => {
  it("3 nuits au même tarif : 1 ligne, quantité 3 × 80 000", async () => {
    const evt = reservationCreee({ nuitees: nuitees(80_000, 80_000, 80_000) });

    await traiterReservationCreee(evt);

    const [ligne, ...autres] = await lignes(evt.payload.reservationId);
    expect(autres).toHaveLength(0);
    expect(ligne).toMatchObject({ origine: "HEBERGEMENT", quantite: 3, prixUnitaire: 80_000, montant: 240_000 });
  });

  it("2 nuits normales + 1 nuit de haute saison : 2 lignes, la saison est nommée", async () => {
    const evt = reservationCreee({
      montantTotal: 280_000,
      nuitees: nuitees(80_000, 80_000, [120_000, "Haute saison"]),
    });

    await traiterReservationCreee(evt);

    const [normale, saison, ...autres] = await lignes(evt.payload.reservationId);
    expect(autres).toHaveLength(0);
    expect(normale).toMatchObject({ quantite: 2, prixUnitaire: 80_000, montant: 160_000, ordre: 0 });
    expect(normale?.libelle).toContain("du 2030-10-10 au 2030-10-12");
    expect(saison).toMatchObject({ quantite: 1, prixUnitaire: 120_000, montant: 120_000, ordre: 1 });
    expect(saison?.libelle).toContain("Haute saison");
  });

  it("seules les nuits CONSÉCUTIVES sont regroupées", async () => {
    const evt = reservationCreee({
      nbNuits: 3,
      montantTotal: 280_000,
      nuitees: nuitees(80_000, [120_000, "Fêtes"], 80_000),
    });

    await traiterReservationCreee(evt);

    expect((await lignes(evt.payload.reservationId)).map((l) => l.quantite)).toEqual([1, 1, 1]);
  });

  it("la somme des lignes d'hébergement = montantTotal, et chaque ligne vaut quantité × prix", async () => {
    const evt = reservationCreee({
      nbNuits: 4,
      montantTotal: 400_000,
      nuitees: nuitees(80_000, [120_000, "Fêtes"], [120_000, "Fêtes"], 80_000),
    });

    await traiterReservationCreee(evt);

    const liste = await lignes(evt.payload.reservationId);
    expect(liste.reduce((s, l) => s + l.montant, 0)).toBe(400_000);
    for (const l of liste) expect(l.quantite * l.prixUnitaire).toBe(l.montant);
  });

  it("ancien format d'événement (sans nuitées) : une seule ligne, comme avant", async () => {
    const evt = reservationCreee(); // pas de champ nuitees

    await traiterReservationCreee(evt);

    const liste = await lignes(evt.payload.reservationId);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ quantite: 3, prixUnitaire: 80_000, montant: 240_000 });
  });

  it("événement rejoué : toujours une facture, mêmes lignes", async () => {
    const evt = reservationCreee({ montantTotal: 280_000, nuitees: nuitees(80_000, 80_000, [120_000, "Haute saison"]) });

    await traiterReservationCreee(evt);
    await traiterReservationCreee(evt);

    expect(await prisma.facture.count()).toBe(1);
    expect(await lignes(evt.payload.reservationId)).toHaveLength(2);
  });

  it("chemin REST (événement en retard) : exactement les mêmes lignes que le chemin événement", async () => {
    const parEvenement = reservationCreee({ montantTotal: 280_000, nuitees: nuitees(80_000, 80_000, [120_000, "Haute saison"]) });
    await traiterReservationCreee(parEvenement);

    // Même réservation (autre id), mais facture créée par la lecture REST
    const parRest = reservationCreee({ ...parEvenement.payload, reservationId: randomUUID() });
    exposerReservation(parRest);
    await obtenirFactureSejour(parRest.payload.reservationId);

    const attendu = (await lignes(parEvenement.payload.reservationId)).map(essentiel);
    expect((await lignes(parRest.payload.reservationId)).map(essentiel)).toEqual(attendu);
  });

  it("consommation.imputee rejouée : une seule ligne restaurant", async () => {
    const evt = reservationCreee({ montantTotal: 280_000, nuitees: nuitees(80_000, 80_000, [120_000, "Haute saison"]) });
    await traiterReservationCreee(evt);
    const conso = enveloppe("consommation.imputee", {
      commandeId: randomUUID(),
      reference: "CMD-2026-000009",
      reservationId: evt.payload.reservationId,
      chambreNumero: "101",
      lignes: [{ libelle: "Romazava", quantite: 1, prixUnitaire: 18_000 }],
      montant: 18_000,
    });

    await traiterConsommationImputee(conso);
    await traiterConsommationImputee(conso);

    const liste = await lignes(evt.payload.reservationId);
    expect(liste.filter((l) => l.origine === "RESTAURANT")).toHaveLength(1);
    expect(liste.filter((l) => l.origine === "HEBERGEMENT")).toHaveLength(2);
  });
});
