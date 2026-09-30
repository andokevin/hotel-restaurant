import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Enveloppe } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterPaiementRecu } from "../src/modules/commande/commande.service.js";
import { faux } from "./faux-services.js";

const SERVEUR = { id: "11111111-1111-4111-8111-111111111111", role: "RESTAURANT" } as const;
const appel = (methode: "get" | "post", chemin: string) =>
  request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "").set("x-utilisateur-id", SERVEUR.id).set("x-utilisateur-role", SERVEUR.role);

const carte = async () => {
  const menu = await prisma.menu.create({ data: { nom: { fr: "Carte du midi" }, actif: true } });
  const romazava = await prisma.plat.create({ data: { menuId: menu.id, nom: { fr: "Romazava" }, categorie: "PLAT", prix: 18_000 } });
  const jus = await prisma.plat.create({ data: { menuId: menu.id, nom: { fr: "Jus de baobab" }, categorie: "BOISSON", prix: 6_000 } });
  const epuise = await prisma.plat.create({ data: { menuId: menu.id, nom: { fr: "Ravitoto" }, categorie: "PLAT", prix: 15_000, disponible: false } });
  return { menu, romazava, jus, epuise };
};
const commander = async () => {
  const { romazava, jus } = await carte();
  return (await appel("post", "/commandes").send({ canal: "SUR_PLACE", tableNumero: "4", lignes: [{ platId: romazava.id, quantite: 2, prix: 1 }, { platId: jus.id, quantite: 1 }] })).body;
};

beforeEach(async () => {
  faux.reinitialiser();
  await prisma.$executeRawUnsafe("TRUNCATE ligne_commande, commande, plat, menu, compteur_commande, outbox_evenement, evenement_traite CASCADE");
});
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

describe("Commande", () => {
  it("les prix viennent de la base (un « prix » envoyé est ignoré), référence CMD-AAAA-NNNNNN", async () => {
    const c = await commander();
    expect(c.montantTotal).toBe(42_000);
    expect(c.reference).toMatch(/^CMD-\d{4}-000001$/);
    expect(c.lignes).toEqual(expect.arrayContaining([expect.objectContaining({ platNom: "Romazava", prixUnitaire: 18_000, quantite: 2 })]));
  });

  it("plat indisponible : 422", async () => {
    const { epuise } = await carte();
    expect((await appel("post", "/commandes").send({ canal: "SUR_PLACE", lignes: [{ platId: epuise.id, quantite: 1 }] })).status).toBe(422);
  });

  it("statuts de préparation dans l'ordre, pas de retour en arrière", async () => {
    const c = await commander();
    expect((await appel("post", `/commandes/${c.id}/statut`).send({ statut: "PRETE" })).status).toBe(422);
    expect((await appel("post", `/commandes/${c.id}/statut`).send({ statut: "EN_PREPARATION" })).body.statut).toBe("EN_PREPARATION");
  });
});

describe("Imputer à la chambre ou facturer au restaurant", () => {
  it("sans séjour en cours dans la chambre : 422 ; avec : IMPUTEE_CHAMBRE + événement consommation.imputee", async () => {
    const c = await commander();
    expect((await appel("post", `/commandes/${c.id}/imputer`).send({ chambreNumero: "204" })).status).toBe(422);

    const sejourId = randomUUID();
    faux.sejours.set("204", { id: sejourId, reference: "RES-2026-000010", clientNom: "Rakoto Jean", chambre: { numero: "204" } });
    const ok = await appel("post", `/commandes/${c.id}/imputer`).send({ chambreNumero: "204" });
    expect(ok.body).toMatchObject({ statutPaiement: "IMPUTEE_CHAMBRE", reservationId: sejourId, chambreNumero: "204" });

    const [evt] = await prisma.outboxEvenement.findMany({ where: { type: "consommation.imputee" } });
    expect(evt?.payload).toMatchObject({ commandeId: c.id, reservationId: sejourId, montant: 42_000 });

    // Ni deuxième imputation, ni facture en plus : la somme ne peut pas être réclamée deux fois
    expect((await appel("post", `/commandes/${c.id}/imputer`).send({ chambreNumero: "204" })).status).toBe(409);
    expect((await appel("post", `/commandes/${c.id}/facturer`)).status).toBe(409);
  });

  it("facturer : facturation reçoit les prix du restaurant ; paiement.recu → commande PAYEE", async () => {
    const c = await commander();
    const f = await appel("post", `/commandes/${c.id}/facturer`);
    expect(f.status).toBe(201);
    expect(f.body.montant).toBe(42_000);
    expect(faux.factures[0]).toMatchObject({ commandeId: c.id, lignes: expect.arrayContaining([{ libelle: "Romazava", quantite: 2, prixUnitaire: 18_000 }]) });

    const evt: Enveloppe<"paiement.recu"> = {
      id: randomUUID(),
      type: "paiement.recu",
      emisLe: new Date().toISOString(),
      payload: { paiementId: randomUUID(), factureId: f.body.factureId, reservationId: null, commandeId: c.id, montant: 42_000 },
    };
    await traiterPaiementRecu(evt);
    await traiterPaiementRecu(evt);
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).statutPaiement).toBe("PAYEE");
  });
});

describe("Menus (lane Communication)", () => {
  it("seuls les menus publiés et les plats disponibles sont visibles ; texte Facebook prêt à copier", async () => {
    const { menu } = await carte();
    await prisma.menu.create({ data: { nom: { fr: "Brouillon" } } });

    const publies = await appel("get", "/menus/publies");
    expect(publies.body).toHaveLength(1);
    expect(publies.body[0].plats.map((p: { nom: { fr: string } }) => p.nom.fr)).toEqual(["Romazava", "Jus de baobab"]);

    const { texte } = (await appel("get", `/menus/${menu.id}/texte-facebook`)).body;
    expect(texte).toContain("Romazava — 18");
    expect(texte).not.toContain("Ravitoto");

    await appel("post", `/menus/${menu.id}/depublier`);
    expect((await appel("get", "/menus/publies")).body).toHaveLength(0);
  });
});
