import { randomUUID } from "node:crypto";
import type { Identite } from "@hotel/commun";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterReservationCreee } from "../src/modules/facture/facture.service.js";
import { appel, evenementsOutbox, RECEPTION, reservationCreee, toutReinitialiser } from "./aide.js";

const COMPTABLE: Identite = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "COMPTABLE" };

beforeEach(() => toutReinitialiser());
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

// Une facture de séjour de 240 000 Ar (EMISE), éventuellement soldée en espèces par la réception
const factureSejour = async ({ soldee = false } = {}) => {
  const evt = reservationCreee();
  await traiterReservationCreee(evt);
  const f = await prisma.facture.findUniqueOrThrow({ where: { reservationId: evt.payload.reservationId } });
  if (soldee) await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 240_000 });
  return f;
};

// Un paiement Papi classé en ANOMALIE par le worker (argent débité chez le client, non compté)
const anomalie = (factureId: string, raison = "Facture déjà soldée : paiement en trop") =>
  prisma.paiement.create({
    data: {
      factureId,
      montant: 240_000,
      montantRecu: 240_000,
      statut: "ANOMALIE",
      methode: "MVOLA",
      referenceExterne: `papi-${randomUUID()}`,
      erreur: raison,
    },
  });

const lister = () => appel("get", "/paiements/anomalies", COMPTABLE);
const rembourse = (id: string, commentaire = "Remboursé depuis le tableau de bord Papi") =>
  appel("post", `/paiements/${id}/rembourse`, COMPTABLE).send({ commentaire });
const accepter = (id: string, commentaire = "Le client n'a payé qu'une fois") =>
  appel("post", `/paiements/${id}/accepter`, COMPTABLE).send({ commentaire });

describe("Anomalies de paiement (#68)", () => {
  it("la liste donne la facture, tous ses paiements, la référence Papi et la situation « à rembourser »", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    const res = await lister();

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: a.id,
      situation: "A_REMBOURSER",
      raison: "Facture déjà soldée : paiement en trop",
      montantRecu: 240_000,
      referenceExterne: a.referenceExterne,
      facture: { numero: f.numero, clientNom: "Rakoto Jean", statut: "PAYEE", resteAPayer: 0 },
    });
    // Tous les paiements de la facture : l'espèce de la réception ET l'anomalie
    expect(res.body[0].facture.paiements.map((p: { statut: string }) => p.statut).sort()).toEqual(["ANOMALIE", "REUSSI"]);
  });

  it("facture non soldée : situation « à accepter »", async () => {
    const f = await factureSejour();
    await anomalie(f.id, "Argent reçu sur un lien remplacé ou refusé");

    expect((await lister()).body[0].situation).toBe("A_ACCEPTER");
  });

  it("marquer remboursé : REMBOURSE, tracé (qui, quand, commentaire), et l'anomalie quitte la liste", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    const res = await rembourse(a.id);

    expect(res.status).toBe(200);
    const p = await prisma.paiement.findUniqueOrThrow({ where: { id: a.id } });
    expect(p).toMatchObject({ statut: "REMBOURSE", traitePar: COMPTABLE.id, commentaire: "Remboursé depuis le tableau de bord Papi" });
    expect(p.traiteLe).toBeInstanceOf(Date);
    expect((await lister()).body).toHaveLength(0);
  });

  it("accepter sur une facture non soldée : REUSSI, facture créditée, un seul paiement.recu", async () => {
    const f = await factureSejour();
    const a = await anomalie(f.id, "Argent reçu sur un lien remplacé ou refusé");

    const res = await accepter(a.id);

    expect(res.status).toBe(200);
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ statut: "REUSSI", traitePar: COMPTABLE.id });
    expect(await prisma.facture.findUniqueOrThrow({ where: { id: f.id } })).toMatchObject({ montantPaye: 240_000, statut: "PAYEE" });
    expect(await evenementsOutbox("paiement.recu")).toHaveLength(1);
  });

  it("accepter sur une facture déjà soldée : 422, rien ne change", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    const res = await accepter(a.id);

    expect(res.status).toBe(422);
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe("ANOMALIE");
    expect((await prisma.facture.findUniqueOrThrow({ where: { id: f.id } })).montantPaye).toBe(240_000);
  });

  it("deux « marquer remboursé » simultanés : une seule action réussit, l'autre reçoit 409", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    const statuts = (await Promise.all([rembourse(a.id, "Comptable 1"), rembourse(a.id, "Comptable 2")])).map((r) => r.status);

    expect(statuts.sort()).toEqual([200, 409]);
  });

  it("action sur un paiement qui n'est pas en ANOMALIE : 409 ; paiement inconnu : 404", async () => {
    const f = await factureSejour();
    const normal = await prisma.paiement.create({ data: { factureId: f.id, montant: 240_000 } }); // EN_ATTENTE

    expect((await rembourse(normal.id)).status).toBe(409);
    expect((await accepter(normal.id)).status).toBe(409);
    expect((await rembourse(randomUUID())).status).toBe(404);
  });

  it("le commentaire est obligatoire : 400", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    expect((await appel("post", `/paiements/${a.id}/rembourse`, COMPTABLE).send({})).status).toBe(400);
    expect((await rembourse(a.id, " ")).status).toBe(400);
  });

  it("défense en profondeur : même derrière la gateway, un réceptionniste reçoit 403", async () => {
    const f = await factureSejour({ soldee: true });
    const a = await anomalie(f.id);

    expect((await appel("get", "/paiements/anomalies", RECEPTION)).status).toBe(403);
    expect((await appel("post", `/paiements/${a.id}/rembourse`, RECEPTION).send({ commentaire: "test" })).status).toBe(403);
  });
});
