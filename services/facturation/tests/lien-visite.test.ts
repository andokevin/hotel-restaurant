import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterReservationCreee } from "../src/modules/facture/facture.service.js";
import { appel, CLIENT_A, CLIENT_B, exposerReservation, RECEPTION, reservationCreee, toutReinitialiser } from "./aide.js";
import { faux } from "./faux-services.js";

beforeEach(() => toutReinitialiser());
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

// Une facture émise + un premier lien de paiement demandé par son client (CLIENT_A)
const factureEtLien = async () => {
  const evt = reservationCreee();
  exposerReservation(evt);
  await traiterReservationCreee(evt);
  const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });
  return { reservationId: evt.payload.reservationId, paiementId: res.body.paiementId as string };
};

const redemander = (reservationId: string) => appel("post", "/paiements", CLIENT_A).send({ reservationId });
const retour = (paiementId: string, identite = CLIENT_A) => appel("post", `/paiements/${paiementId}/retour`, identite);

describe("Lien Papi visité : ne plus le réutiliser (#69)", () => {
  it("lien visité puis nouvelle demande dans les 30 s : un NOUVEAU lien, l'ancien est remplacé", async () => {
    const { reservationId, paiementId } = await factureEtLien();

    expect((await retour(paiementId)).status).toBe(204); // le client revient de Papi (échec)
    const encore = await redemander(reservationId); // il clique « Réessayer » tout de suite

    expect(encore.status).toBe(201);
    expect(encore.body.paiementId).not.toBe(paiementId);
    expect(faux.papi.demandes).toHaveLength(2);
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).toMatchObject({
      statut: "ECHOUE",
      erreur: "Remplacé par un nouveau lien de paiement",
    });
  });

  it("double clic sans passage sur Papi (non visité, moins de 30 s) : le MÊME lien", async () => {
    const { reservationId, paiementId } = await factureEtLien();

    const encore = await redemander(reservationId);

    expect(encore.body.paiementId).toBe(paiementId);
    expect(faux.papi.demandes).toHaveLength(1);
  });

  it("un client ne peut pas marquer le paiement d'un autre : 404", async () => {
    const { paiementId } = await factureEtLien();

    expect((await retour(paiementId, CLIENT_B)).status).toBe(404);
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).visiteLe).toBeNull();
  });

  it("la réception peut marquer le retour d'un paiement au comptoir", async () => {
    const { paiementId } = await factureEtLien();

    expect((await retour(paiementId, RECEPTION)).status).toBe(204);
  });

  it("le retour ne change JAMAIS le statut du paiement (l'URL de retour n'est pas une preuve)", async () => {
    const { paiementId } = await factureEtLien();

    await retour(paiementId);

    const p = await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } });
    expect(p.statut).toBe("EN_ATTENTE");
    expect(p.visiteLe).toBeInstanceOf(Date);
  });

  it("appelé deux fois : visiteLe garde la PREMIÈRE date", async () => {
    const { paiementId } = await factureEtLien();
    await retour(paiementId);
    const premiere = (await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).visiteLe;

    await new Promise((ok) => setTimeout(ok, 20));
    await retour(paiementId);

    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).visiteLe).toEqual(premiere);
  });

  it("paiement inconnu ou id invalide : 404 / 400", async () => {
    expect((await retour("7b1f3c2a-9d4e-4f5a-8b6c-1d2e3f4a5b6c")).status).toBe(404);
    expect((await retour("pas-un-uuid")).status).toBe(400);
  });
});
