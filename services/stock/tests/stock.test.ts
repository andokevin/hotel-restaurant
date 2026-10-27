import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { aujourdhuiMadagascar, type Enveloppe } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterMenageTermine } from "../src/modules/article/article.service.js";
import { ecrireEvenement } from "../src/outbox.js";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN" } as const;
const appel = (methode: "get" | "post", chemin: string) =>
  request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "").set("x-utilisateur-id", ADMIN.id).set("x-utilisateur-role", ADMIN.role);

const menageTermine = (articles: { code: string; quantite: number }[]): Enveloppe<"menage.termine"> => ({
  id: randomUUID(),
  type: "menage.termine",
  emisLe: new Date().toISOString(),
  payload: { tacheId: randomUUID(), type: "DEPART", reservationId: randomUUID(), chambreId: randomUUID(), chambreNumero: "204", articles, termineLe: new Date().toISOString() },
});

const creer = (code: string, quantite: number, seuilAlerte = 5) =>
  prisma.article.create({ data: { code, libelle: { fr: code }, quantite, seuilAlerte } });
const stock = async (code: string) => (await prisma.article.findUniqueOrThrow({ where: { code } })).quantite;

beforeEach(() => prisma.$executeRawUnsafe("TRUNCATE mouvement, article, outbox_evenement, evenement_traite CASCADE"));
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

describe("Sortie des articles par le ménage (menage.termine)", () => {
  it("20 ménages terminés en même temps : exactement 20 sorties (décrément atomique)", async () => {
    await creer("GEL_DOUCHE", 20);
    await Promise.all(Array.from({ length: 20 }, () => traiterMenageTermine(menageTermine([{ code: "GEL_DOUCHE", quantite: 1 }]))));

    expect(await stock("GEL_DOUCHE")).toBe(0);
    expect(await prisma.mouvement.count({ where: { motif: "MENAGE" } })).toBe(20);
  });

  it("événement rejoué : rien n'est sorti deux fois (UNIQUE tâche + article)", async () => {
    await creer("GEL_DOUCHE", 10);
    const evt = menageTermine([{ code: "GEL_DOUCHE", quantite: 2 }]);
    await traiterMenageTermine(evt);
    await traiterMenageTermine(evt);
    expect(await stock("GEL_DOUCHE")).toBe(8);
  });

  it("rupture d'un article : les autres sont sortis, le stock ne devient jamais négatif", async () => {
    await creer("GEL_DOUCHE", 0);
    await creer("PANTOUFLE", 10);
    await traiterMenageTermine(
      menageTermine([
        { code: "GEL_DOUCHE", quantite: 1 },
        { code: "PANTOUFLE", quantite: 1 },
        { code: "ARTICLE_INCONNU", quantite: 1 },
      ]),
    );
    expect(await stock("GEL_DOUCHE")).toBe(0);
    expect(await stock("PANTOUFLE")).toBe(9);
  });

  it("le seuil d'alerte est signalé une fois, au franchissement", async () => {
    await creer("BROSSE_A_DENTS", 7, 5);
    for (let i = 0; i < 4; i++) await traiterMenageTermine(menageTermine([{ code: "BROSSE_A_DENTS", quantite: 1 }]));
    // 7 → 6 → 5 (franchi) → 4 → 3
    const alertes = await prisma.outboxEvenement.findMany({ where: { type: "stock.seuil_atteint" } });
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.payload).toMatchObject({ code: "BROSSE_A_DENTS", quantite: 5 });
  });
});

describe("Mouvements manuels et lecture", () => {
  it("approvisionnement +, perte −, et une perte plus grande que le stock est refusée (422)", async () => {
    const a = await creer("PAPIER_HYGIENIQUE", 3);
    expect((await appel("post", `/articles/${a.id}/mouvements`).send({ type: "ENTREE", motif: "APPROVISIONNEMENT", quantite: 50 })).body.quantite).toBe(53);
    const refus = await appel("post", `/articles/${a.id}/mouvements`).send({ type: "SORTIE", motif: "PERTE", quantite: 100 });
    expect(refus.status).toBe(422);
    expect(refus.body.code).toBe("STOCK_INSUFFISANT");
    expect(await stock("PAPIER_HYGIENIQUE")).toBe(53);
    expect((await appel("post", `/articles/${a.id}/mouvements`).send({ type: "SORTIE", motif: "APPROVISIONNEMENT", quantite: 1 })).status).toBe(400);
  });

  it("liste avec alerte, et sorties MENAGE du jour pour la comptabilité", async () => {
    await creer("GEL_DOUCHE", 3, 5);
    await creer("PANTOUFLE", 50, 5);
    await traiterMenageTermine(menageTermine([{ code: "PANTOUFLE", quantite: 2 }]));

    const liste = await appel("get", "/articles");
    expect(liste.body.find((a: { code: string }) => a.code === "GEL_DOUCHE").enAlerte).toBe(true);

    const sorties = await appel("get", `/interne/sorties-menage?jour=${aujourdhuiMadagascar()}`);
    expect(sorties.body).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PANTOUFLE", quantite: 2 }), expect.objectContaining({ code: "GEL_DOUCHE", quantite: 0 })]));
  });
});

describe("Producteur d'événements (ecrireEvenement)", () => {
  it("contenu contraire au contrat : erreur, et la transaction métier est annulée", async () => {
    // `as never` contourne TypeScript, comme le ferait une donnée inattendue à l'exécution.
    const ecriture = prisma.$transaction(async (tx) => {
      await tx.article.create({ data: { code: "SAVON", libelle: { fr: "Savon" }, quantite: 3, seuilAlerte: 5 } });
      await ecrireEvenement(tx, "stock.seuil_atteint", { articleId: "pas-un-uuid", code: "SAVON", quantite: -1, seuilAlerte: 5 } as never);
    });

    await expect(ecriture).rejects.toThrow(/stock\.seuil_atteint/);
    expect(await prisma.article.count({ where: { code: "SAVON" } })).toBe(0);
    expect(await prisma.outboxEvenement.count()).toBe(0);
  });
});
