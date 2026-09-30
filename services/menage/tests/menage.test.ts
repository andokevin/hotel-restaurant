import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { aujourdhuiMadagascar, type ContenuEvenement, type Enveloppe, type Identite, type TypeEvenement } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterSejourCommence, traiterSejourTermine } from "../src/modules/tache/tache.service.js";

const HANTA: Identite = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "FEMME_MENAGE" };
const VOLA: Identite = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "FEMME_MENAGE" };

const appel = (chemin: string, identite: Identite) =>
  request(app).post(chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "").set("x-utilisateur-id", identite.id).set("x-utilisateur-role", identite.role);
const enveloppe = <T extends TypeEvenement>(type: T, payload: ContenuEvenement<T>): Enveloppe<T> => ({ id: randomUUID(), type, emisLe: new Date().toISOString(), payload });
const sejour = { reservationId: randomUUID(), chambreId: randomUUID(), chambreNumero: "204" };
const ARTICLES = [
  { code: "GEL_DOUCHE", quantite: 1 },
  { code: "PAPIER_HYGIENIQUE", quantite: 1 },
  { code: "PANTOUFLE", quantite: 1 },
  { code: "BROSSE_A_DENTS", quantite: 1 },
];

beforeEach(() => prisma.$executeRawUnsafe("TRUNCATE tache_menage, outbox_evenement, evenement_traite"));
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

describe("Tâches créées par les événements du séjour", () => {
  it("sejour.commence (10→13) : ménages QUOTIDIEN les 11 et 12, une seule fois", async () => {
    const evt = enveloppe("sejour.commence", { ...sejour, dateArrivee: "2030-10-10", dateDepart: "2030-10-13" });
    await traiterSejourCommence(evt);
    await traiterSejourCommence(evt);

    const taches = await prisma.tacheMenage.findMany({ orderBy: { datePrevue: "asc" } });
    expect(taches.map((t) => [t.type, t.datePrevue.toISOString().slice(0, 10)])).toEqual([
      ["QUOTIDIEN", "2030-10-11"],
      ["QUOTIDIEN", "2030-10-12"],
    ]);
  });

  it("sejour.termine : tâche DEPART du jour, ménages quotidiens restants supprimés (départ anticipé)", async () => {
    const aujourdhui = aujourdhuiMadagascar();
    await prisma.tacheMenage.create({ data: { ...sejour, type: "QUOTIDIEN", datePrevue: new Date(aujourdhui) } });
    const evt = enveloppe("sejour.termine", {
      ...sejour,
      dateArrivee: "2030-10-10",
      dateDepart: "2030-10-13",
      nbNuits: 3,
      checkOutLe: new Date().toISOString(),
    });

    await traiterSejourTermine(evt);
    await traiterSejourTermine(evt);

    const taches = await prisma.tacheMenage.findMany();
    expect(taches).toHaveLength(1);
    expect(taches[0]).toMatchObject({ type: "DEPART", statut: "A_FAIRE" });
  });
});

describe("Démarrer et terminer", () => {
  const tacheDepart = () => prisma.tacheMenage.create({ data: { ...sejour, type: "DEPART", datePrevue: new Date(aujourdhuiMadagascar()) } });

  it("deux employées démarrent en même temps : une seule obtient la tâche", async () => {
    const t = await tacheDepart();
    const [a, b] = await Promise.all([appel(`/taches/${t.id}/demarrer`, HANTA), appel(`/taches/${t.id}/demarrer`, VOLA)]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await prisma.tacheMenage.findUniqueOrThrow({ where: { id: t.id } })).version).toBe(2);
  });

  it("seule l'employée assignée termine ; menage.termine porte les articles remplacés", async () => {
    const t = await tacheDepart();
    await appel(`/taches/${t.id}/demarrer`, HANTA);

    expect((await appel(`/taches/${t.id}/terminer`, VOLA).send({ articles: ARTICLES })).status).toBe(403);
    const ok = await appel(`/taches/${t.id}/terminer`, HANTA).send({ articles: ARTICLES, remarques: "Chargeur oublié" });
    expect(ok.status).toBe(200);
    expect(ok.body.statut).toBe("TERMINEE");
    expect((await appel(`/taches/${t.id}/terminer`, HANTA).send({ articles: ARTICLES })).status).toBe(422);

    const evts = await prisma.outboxEvenement.findMany({ where: { type: "menage.termine" } });
    expect(evts).toHaveLength(1);
    expect(evts[0]?.payload).toMatchObject({ tacheId: t.id, type: "DEPART", chambreNumero: "204", articles: ARTICLES });
  });

  it("un article déclaré deux fois est refusé (400)", async () => {
    const t = await tacheDepart();
    await appel(`/taches/${t.id}/demarrer`, HANTA);
    const res = await appel(`/taches/${t.id}/terminer`, HANTA).send({ articles: [ARTICLES[0], ARTICLES[0]] });
    expect(res.status).toBe(400);
  });
});
