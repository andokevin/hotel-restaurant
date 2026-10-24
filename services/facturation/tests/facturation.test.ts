import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { empreinteSha256, UnrecoverableError } from "@hotel/commun";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import {
  traiterConsommationImputee,
  traiterReservationCreee,
  traiterSejourTermine,
} from "../src/modules/facture/facture.service.js";
import { FILE_NOTIFICATIONS, traiterNotification } from "../src/modules/paiement/paiement.service.js";
import {
  appel,
  CLIENT_A,
  CLIENT_B,
  derniereDemandePapi,
  enveloppe,
  evenementsOutbox,
  exposerReservation,
  notifier,
  RECEPTION,
  reservationCreee,
  toutReinitialiser,
} from "./aide.js";
import { faux } from "./faux-services.js";

beforeEach(() => toutReinitialiser());
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

const facture = (reservationId: string) =>
  prisma.facture.findUniqueOrThrow({ where: { reservationId }, include: { lignes: true, paiements: true } });

// Une facture émise + un lien de paiement demandé par son client
const factureEtLien = async () => {
  const evt = reservationCreee();
  exposerReservation(evt);
  await traiterReservationCreee(evt);
  const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });
  const demande = derniereDemandePapi();
  return { evt, res, demande, paiementId: res.body.paiementId as string };
};

// Notification Papi « réussie » cohérente avec la demande
const notificationReussie = (demande: ReturnType<typeof derniereDemandePapi>, surcharge: Record<string, unknown> = {}) => ({
  paymentStatus: "SUCCESS",
  paymentMethod: "MVOLA",
  currency: "MGA",
  amount: demande.corps.amount,
  merchantPaymentReference: demande.corps.reference,
  paymentReference: `papi-${randomUUID()}`,
  notificationToken: `jeton-papi-${String(demande.corps.reference)}`,
  ...surcharge,
});

const job = (paiementId: string, notification: Record<string, unknown>) => ({ paiementId, notification });

// ---------------------------------------------------------------------------
describe("Émission de la facture (reservation.creee)", () => {
  it("crée une facture SEJOUR numérotée, avec le snapshot du client, une seule fois", async () => {
    const evt = reservationCreee();

    await traiterReservationCreee(evt);
    await traiterReservationCreee(evt); // doublon

    const f = await facture(evt.payload.reservationId);
    expect(await prisma.facture.count()).toBe(1);
    expect(f.numero).toMatch(/^FAC-\d{4}-000001$/);
    expect(f).toMatchObject({ type: "SEJOUR", statut: "EMISE", montantTotal: 240_000, montantPaye: 0, clientEmail: "rakoto@mail.mg" });
    expect(f.lignes).toHaveLength(1);
    expect(f.lignes[0]).toMatchObject({ origine: "HEBERGEMENT", quantite: 3, prixUnitaire: 80_000, montant: 240_000 });
  });

  it("numérotation sans trou, même en rafale", async () => {
    await Promise.all(Array.from({ length: 20 }, () => traiterReservationCreee(reservationCreee())));

    const numeros = (await prisma.facture.findMany({ select: { numero: true } })).map((f) => Number(f.numero.slice(-6)));
    expect(numeros.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("nuits à des tarifs différents (saisons) : 1 × le total, pour que quantité × prix = montant", async () => {
    const evt = reservationCreee({ montantTotal: 250_000 }); // 250 000 / 3 n'est pas entier
    await traiterReservationCreee(evt);
    expect((await facture(evt.payload.reservationId)).lignes[0]).toMatchObject({ quantite: 1, prixUnitaire: 250_000 });
  });
});

// ---------------------------------------------------------------------------
describe("Demande de paiement (lien Papi)", () => {
  it("le montant vient du serveur, la clé part dans l'en-tête Token, le jeton n'est stocké qu'haché", async () => {
    const { res, demande, paiementId } = await factureEtLien();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ montant: 240_000, url: `https://papi.test/payer/${paiementId}` });
    expect(demande.token).toBe("cle-papi-de-test");
    expect(demande.corps).toMatchObject({
      amount: 240_000,
      reference: paiementId,
      payerEmail: "rakoto@mail.mg",
      payerPhone: "0341234567",
      isTestMode: true,
    });

    const notificationUrl = new URL(String(demande.corps.notificationUrl));
    expect(notificationUrl.origin + notificationUrl.pathname).toBe("https://passerelle.test/api/paiements/notification");
    const jeton = notificationUrl.searchParams.get("jeton") ?? "";
    expect(jeton.length).toBeGreaterThan(30);

    const p = await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } });
    expect(p.jetonHash).toBe(empreinteSha256(jeton));
    expect(p.jetonHash).not.toContain(jeton);
    expect(p.notificationTokenHash).toBe(empreinteSha256(`jeton-papi-${paiementId}`));
  });

  it("un montant envoyé par le navigateur est refusé (400), pas utilisé", async () => {
    const evt = reservationCreee();
    exposerReservation(evt);
    await traiterReservationCreee(evt);

    const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId, montant: 1 });
    expect(res.status).toBe(400);
    expect(faux.papi.demandes).toHaveLength(0);
  });

  it("un client ne peut pas payer (ni découvrir) la facture d'un autre", async () => {
    const evt = reservationCreee();
    exposerReservation(evt);
    await traiterReservationCreee(evt);

    expect((await appel("post", "/paiements", CLIENT_B).send({ reservationId: evt.payload.reservationId })).status).toBe(404);
  });

  it("double clic : le même lien est renvoyé, Papi n'est appelé qu'une fois", async () => {
    const { evt, res } = await factureEtLien();

    const encore = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });

    expect(encore.body).toEqual(res.body);
    expect(faux.papi.demandes).toHaveLength(1);
    expect(await prisma.paiement.count()).toBe(1);
  });

  it("lien ancien (client déjà passé sur Papi) : un NOUVEAU lien, l'ancien est remplacé", async () => {
    // Préparer : une facture et un premier lien de paiement
    const { evt, paiementId } = await factureEtLien();
    // Le lien a 2 minutes : le client est sans doute déjà passé sur Papi, ce lien peut être consommé.
    // On modifie la date en base au lieu d'attendre : le test reste rapide.
    await prisma.paiement.update({ where: { id: paiementId }, data: { createdAt: new Date(Date.now() - 2 * 60_000) } });

    // Agir : le client clique de nouveau sur « Payer »
    const encore = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });

    // Vérifier : un NOUVEAU lien, l'ancien est remplacé, un seul paiement reste en attente
    expect(encore.status).toBe(201);
    expect(encore.body.paiementId).not.toBe(paiementId);
    expect(faux.papi.demandes).toHaveLength(2);
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).toMatchObject({
      statut: "ECHOUE",
      erreur: "Remplacé par un nouveau lien de paiement",
    });
    expect(await prisma.paiement.count({ where: { statut: "EN_ATTENTE" } })).toBe(1);
  });

  it("argent reçu malgré tout sur l'ancien lien : ANOMALIE, rien n'est encaissé", async () => {
    // Préparer : lien A, vieilli de 2 minutes, puis remplacé par un lien B quand le client reclique.
    // On garde `demande` (ce que le faux Papi a reçu pour A) pour fabriquer la notification de A.
    const { evt, demande, paiementId } = await factureEtLien();
    await prisma.paiement.update({ where: { id: paiementId }, data: { createdAt: new Date(Date.now() - 2 * 60_000) } });
    await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });

    // Agir : Papi annonce, en retard, que l'ANCIEN lien (A) a été payé (ex. confirmation MVola tardive)
    await traiterNotification(job(paiementId, notificationReussie(demande)));

    // Vérifier : A passe en ANOMALIE (remboursement manuel) et la facture n'a rien encaissé
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).toMatchObject({ statut: "ANOMALIE" });
    expect((await facture(evt.payload.reservationId)).montantPaye).toBe(0);
  });

  it("deux demandes simultanées : un seul paiement en attente (index unique partiel)", async () => {
    const evt = reservationCreee();
    exposerReservation(evt);
    await traiterReservationCreee(evt);

    const reponses = await Promise.all(
      [1, 2, 3].map(() => appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId })),
    );

    expect(reponses.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(reponses.some((r) => r.status === 201)).toBe(true);
    expect(await prisma.paiement.count({ where: { statut: "EN_ATTENTE" } })).toBe(1);
  });

  it("réservation expirée entre-temps : refus, facture annulée, Papi jamais appelé", async () => {
    const evt = reservationCreee();
    exposerReservation(evt, "ANNULEE");
    await traiterReservationCreee(evt);

    const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("RESERVATION_ANNULEE");
    expect((await facture(evt.payload.reservationId)).statut).toBe("ANNULEE");
    expect(faux.papi.demandes).toHaveLength(0);
  });

  it("facture pas encore émise (événement en retard) : relue en REST et émise à la volée", async () => {
    const evt = reservationCreee();
    exposerReservation(evt); // hebergement la connaît, mais reservation.creee n'est pas encore traité

    const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });
    expect(res.status).toBe(201);

    await traiterReservationCreee(evt); // l'événement arrive ensuite : aucun doublon
    expect(await prisma.facture.count()).toBe(1);
  });

  it("Papi en panne : 502, paiement ECHOUE, et on peut réessayer ensuite", async () => {
    const evt = reservationCreee();
    exposerReservation(evt);
    await traiterReservationCreee(evt);
    faux.papi.enPanne = true;

    const res = await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId });
    expect(res.status).toBe(502);
    expect((await prisma.paiement.findFirstOrThrow()).statut).toBe("ECHOUE");

    faux.papi.enPanne = false;
    expect((await appel("post", "/paiements", CLIENT_A).send({ reservationId: evt.payload.reservationId })).status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
describe("Notification Papi (route HTTP)", () => {
  it("jeton faux ou paiement inconnu : 401, rien n'est mis en file", async () => {
    const { demande, paiementId } = await factureEtLien();
    const vraie = new URL(String(demande.corps.notificationUrl));

    const fausse = new URL(vraie);
    fausse.searchParams.set("jeton", "x".repeat(43));
    const inconnue = new URL(vraie);
    inconnue.searchParams.set("paiement", randomUUID());

    expect((await notifier(fausse.toString(), notificationReussie(demande))).status).toBe(401);
    expect((await notifier(inconnue.toString(), notificationReussie(demande))).status).toBe(401);
    expect(await bus.file(FILE_NOTIFICATIONS).count()).toBe(0);
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).statut).toBe("EN_ATTENTE");
  });

  it("bon jeton : 200 immédiat, traitement délégué à BullMQ, une seule fois par notification", async () => {
    const { demande, paiementId } = await factureEtLien();
    const corps = notificationReussie(demande);

    const r1 = await notifier(String(demande.corps.notificationUrl), corps);
    const r2 = await notifier(String(demande.corps.notificationUrl), corps); // Papi renvoie la même

    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await bus.file(FILE_NOTIFICATIONS).count()).toBe(1);
    // Rien n'est encore encaissé : c'est le worker qui le fera
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).statut).toBe("EN_ATTENTE");
  });
});

// ---------------------------------------------------------------------------
describe("Traitement de la notification (worker)", () => {
  it("succès : paiement REUSSI, facture PAYEE, événement paiement.recu", async () => {
    const { evt, demande, paiementId } = await factureEtLien();
    const n = notificationReussie(demande);

    await traiterNotification(job(paiementId, n));

    const p = await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } });
    expect(p).toMatchObject({ statut: "REUSSI", methode: "MVOLA", referenceExterne: n.paymentReference });
    expect(await facture(evt.payload.reservationId)).toMatchObject({ statut: "PAYEE", montantPaye: 240_000 });
    const [recu] = await evenementsOutbox("paiement.recu");
    expect(recu?.payload).toMatchObject({ paiementId, reservationId: evt.payload.reservationId, montant: 240_000 });
  });

  it("même notification traitée deux fois, ou deux notifications en même temps : encaissé UNE fois", async () => {
    const { evt, demande, paiementId } = await factureEtLien();

    await traiterNotification(job(paiementId, notificationReussie(demande)));
    await traiterNotification(job(paiementId, notificationReussie(demande)));
    await Promise.all([1, 2].map(() => traiterNotification(job(paiementId, notificationReussie(demande)))));

    expect((await facture(evt.payload.reservationId)).montantPaye).toBe(240_000);
    expect(await evenementsOutbox("paiement.recu")).toHaveLength(1);
  });

  it("notificationToken faux : refus définitif (pas de réessai), rien n'est encaissé", async () => {
    const { demande, paiementId } = await factureEtLien();

    await expect(traiterNotification(job(paiementId, notificationReussie(demande, { notificationToken: "forge" })))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).statut).toBe("EN_ATTENTE");
  });

  it("montant reçu différent : ANOMALIE (argent débité, à traiter à la main), facture inchangée", async () => {
    const { evt, demande, paiementId } = await factureEtLien();

    await traiterNotification(job(paiementId, notificationReussie(demande, { amount: 1_000 })));

    const p = await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } });
    expect(p.statut).toBe("ANOMALIE");
    expect(p.erreur).toContain("reçu 1000");
    expect((await facture(evt.payload.reservationId)).montantPaye).toBe(0);
  });

  it("forme réelle de Papi : « message: null » ne devient pas le texte \"null\"", async () => {
    const { demande, paiementId } = await factureEtLien();
    await traiterNotification(job(paiementId, notificationReussie(demande, { paymentStatus: "FAILED", message: null })));
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).toMatchObject({ statut: "ECHOUE", erreur: "Paiement refusé" });
  });

  it("FAILED : paiement ECHOUE ; PENDING : rien ne change", async () => {
    const { demande, paiementId } = await factureEtLien();

    await traiterNotification(job(paiementId, notificationReussie(demande, { paymentStatus: "PENDING" })));
    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).statut).toBe("EN_ATTENTE");

    await traiterNotification(job(paiementId, notificationReussie(demande, { paymentStatus: "FAILED", message: "Solde insuffisant" })));
    expect(await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).toMatchObject({
      statut: "ECHOUE",
      erreur: "Solde insuffisant",
    });
  });

  it("surpaiement : facture soldée en espèces, puis Papi confirme → ANOMALIE, la base refuse d'encaisser plus", async () => {
    const { evt, demande, paiementId } = await factureEtLien();
    const f = await facture(evt.payload.reservationId);
    await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 240_000 });

    await traiterNotification(job(paiementId, notificationReussie(demande)));

    expect((await prisma.paiement.findUniqueOrThrow({ where: { id: paiementId } })).statut).toBe("ANOMALIE");
    expect((await facture(evt.payload.reservationId)).montantPaye).toBe(240_000);
  });
});

// ---------------------------------------------------------------------------
describe("Espèces, consommations restaurant et clôture", () => {
  const factureEmise = async () => {
    const evt = reservationCreee();
    await traiterReservationCreee(evt);
    return { evt, f: await facture(evt.payload.reservationId) };
  };

  it("encaisser plus que le reste à payer est refusé par la base (422)", async () => {
    const { f } = await factureEmise();

    const res = await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 300_000 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("MONTANT_SUPERIEUR_AU_RESTE");

    const ok = await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 240_000 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ statut: "PAYEE", montantPaye: 240_000 });
    expect(ok.body.paiements[0]).toMatchObject({ methode: "ESPECES", statut: "REUSSI" });
  });

  it("séjour payé puis terminé : facture CLOTUREE et copie (facture.cloturee) pour le comptable", async () => {
    const { evt, f } = await factureEmise();
    await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 240_000 });
    const fin = enveloppe("sejour.termine", {
      reservationId: evt.payload.reservationId,
      chambreId: randomUUID(),
      chambreNumero: "101",
      dateArrivee: "2030-10-10",
      dateDepart: "2030-10-13",
      nbNuits: 3,
      checkOutLe: new Date().toISOString(),
    });

    await traiterSejourTermine(fin);
    await traiterSejourTermine(fin);

    expect((await facture(evt.payload.reservationId)).statut).toBe("CLOTUREE");
    const copies = await evenementsOutbox("facture.cloturee");
    expect(copies).toHaveLength(1);
    expect(copies[0]?.payload).toMatchObject({ numero: f.numero, montantTotal: 240_000, lignes: [{ origine: "HEBERGEMENT" }] });
  });

  it("consommation restaurant imputée : ligne RESTAURANT, total augmenté, clôture seulement après le solde", async () => {
    const { evt, f } = await factureEmise();
    await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 240_000 }); // séjour payé
    const conso = enveloppe("consommation.imputee", {
      commandeId: randomUUID(),
      reference: "CMD-2026-000007",
      reservationId: evt.payload.reservationId,
      chambreNumero: "101",
      lignes: [
        { libelle: "Romazava", quantite: 2, prixUnitaire: 18_000 },
        { libelle: "THB 65 cl", quantite: 1, prixUnitaire: 7_000 },
      ],
      montant: 43_000,
    });

    await traiterConsommationImputee(conso);
    await traiterConsommationImputee(conso); // doublon

    const apres = await facture(evt.payload.reservationId);
    expect(apres).toMatchObject({ statut: "EMISE", montantTotal: 283_000, montantPaye: 240_000 });
    expect(apres.lignes.find((l) => l.origine === "RESTAURANT")).toMatchObject({ montant: 43_000 });

    // Reste à payer : la clôture est refusée
    expect((await appel("post", `/factures/${f.id}/cloturer`, RECEPTION)).status).toBe(422);
    await appel("post", `/factures/${f.id}/encaissements`, RECEPTION).send({ montant: 43_000 });
    const cloture = await appel("post", `/factures/${f.id}/cloturer`, RECEPTION);
    expect(cloture.status).toBe(200);
    expect(cloture.body.statut).toBe("CLOTUREE");

    // La copie distingue l'argent de l'hôtel de celui du restaurant
    const [copie] = await evenementsOutbox("facture.cloturee");
    const origines = (copie?.payload as { lignes: { origine: string; montant: number }[] }).lignes;
    expect(origines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origine: "HEBERGEMENT", montant: 240_000 }),
        expect.objectContaining({ origine: "RESTAURANT", montant: 43_000 }),
      ]),
    );
  });

  it("consommation arrivée avant la facture : erreur (BullMQ réessaiera), rien n'est marqué traité", async () => {
    const conso = enveloppe("consommation.imputee", {
      commandeId: randomUUID(),
      reference: "CMD-2026-000008",
      reservationId: randomUUID(),
      chambreNumero: "101",
      lignes: [{ libelle: "Café", quantite: 1, prixUnitaire: 3_000 }],
      montant: 3_000,
    });

    await expect(traiterConsommationImputee(conso)).rejects.toThrow(/pas encore émise/);
    expect(await prisma.evenementTraite.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("Lecture", () => {
  it("un client ne voit que ses factures et ses paiements, jamais les empreintes des jetons", async () => {
    const { evt, paiementId } = await factureEtLien();
    const f = await facture(evt.payload.reservationId);

    const mes = await appel("get", "/factures/mes-factures", CLIENT_A);
    expect(mes.body.map((x: { id: string }) => x.id)).toEqual([f.id]);
    expect((await appel("get", "/factures/mes-factures", CLIENT_B)).body).toEqual([]);
    expect((await appel("get", `/factures/${f.id}`, CLIENT_B)).status).toBe(404);

    const p = await appel("get", `/paiements/${paiementId}`, CLIENT_A);
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ statut: "EN_ATTENTE", facture: { numero: f.numero } });
    expect(JSON.stringify(p.body)).not.toMatch(/jetonHash|notificationTokenHash/);
    expect(JSON.stringify((await appel("get", `/factures/${f.id}`, CLIENT_A)).body)).not.toMatch(/jetonHash|notificationTokenHash/);
    expect((await appel("get", `/paiements/${paiementId}`, CLIENT_B)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe("Facture restaurant (appel interne du service restaurant)", () => {
  const demande = (commandeId: string) => ({
    commandeId,
    reference: "CMD-2026-000001",
    clientNom: "Table 4",
    lignes: [
      { libelle: "Romazava", quantite: 2, prixUnitaire: 18_000 },
      { libelle: "Jus de baobab", quantite: 1, prixUnitaire: 6_000 },
    ],
  });

  it("idempotente, montant calculé, puis clôturée dès l'encaissement complet", async () => {
    const commandeId = randomUUID();
    const a = await appel("post", "/interne/factures/restaurant").send(demande(commandeId));
    const b = await appel("post", "/interne/factures/restaurant").send(demande(commandeId));
    expect(a.status).toBe(201);
    expect(b.body.id).toBe(a.body.id);
    expect(a.body).toMatchObject({ type: "RESTAURANT", montantTotal: 42_000 });

    const encaisse = await appel("post", `/factures/${a.body.id}/encaissements`, RECEPTION).send({ montant: 42_000 });
    expect(encaisse.body.statut).toBe("CLOTUREE");
    const [copie] = await evenementsOutbox("facture.cloturee");
    expect(copie?.payload).toMatchObject({ type: "RESTAURANT", commandeId, lignes: [{ origine: "RESTAURANT", montant: 42_000 }] });
    const [recu] = await evenementsOutbox("paiement.recu");
    expect(recu?.payload).toMatchObject({ commandeId, reservationId: null });
  });
});
