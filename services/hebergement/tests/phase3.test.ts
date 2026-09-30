import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { nomFile, type ContenuEvenement, type Enveloppe, type TypeEvenement } from "@hotel/commun";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { traiterMenageTermine } from "../src/modules/chambre/menage.js";
import {
  balayerExpirations,
  expirerReservation,
  FILE_EXPIRATIONS,
} from "../src/modules/reservation/expiration.js";
import { traiterPaiementRecu } from "../src/modules/reservation/reservation.service.js";
import { relayerOutbox } from "../src/outbox.js";
import {
  appel,
  CLIENT_A,
  CLIENT_B,
  creerCategorie,
  creerChambre,
  demandeReservation,
  evenementsOutbox,
  jour,
  RECEPTION,
  reserver,
  viderBase,
  viderFiles,
} from "./aide.js";

beforeEach(async () => {
  await viderBase();
  await viderFiles();
});
afterAll(async () => {
  await bus.fermer();
  await prisma.$disconnect();
});

const enveloppe = <T extends TypeEvenement>(type: T, payload: ContenuEvenement<T>): Enveloppe<T> => ({
  id: randomUUID(),
  type,
  emisLe: new Date().toISOString(),
  payload,
});

const confirmer = (id: string) => appel("post", `/interne/reservations/${id}/confirmer`);
const lire = (id: string) => prisma.reservation.findUniqueOrThrow({ where: { id }, include: { chambre: true } });

// ---------------------------------------------------------------------------
describe("Choix de la chambre par le serveur (décision D3)", () => {
  it("3 demandes simultanées pour 2 chambres : 2 réussissent sur 2 chambres différentes, 1 est refusée", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    await creerChambre(cat.id, "102");

    const reponses = await Promise.all([1, 2, 3].map(() => reserver(cat.id, "2030-10-10", "2030-10-13")));

    expect(reponses.map((r) => r.status).sort()).toEqual([201, 201, 409]);
    const chambres = reponses.filter((r) => r.status === 201).map((r) => r.body.chambreId);
    expect(new Set(chambres).size).toBe(2);
    expect(reponses.find((r) => r.status === 409)?.body.code).toBe("AUCUNE_CHAMBRE_DISPONIBLE");
  });

  it("ignore les chambres hors service et celles d'une autre catégorie", async () => {
    const standard = await creerCategorie("STANDARD");
    const suite = await creerCategorie("SUITE_SENIOR", 150_000);
    await creerChambre(standard.id, "101", "PROPRE", true); // hors service
    await creerChambre(suite.id, "301"); // libre, mais autre catégorie

    expect((await reserver(standard.id, "2030-10-10", "2030-10-12")).status).toBe(409);
  });

  it("une chambre SALE aujourd'hui reste réservable pour des dates futures (la propreté se vérifie au check-in)", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101", "SALE");

    expect((await reserver(cat.id, "2030-10-10", "2030-10-12")).status).toBe(201);
  });

  it("catégorie inconnue : 404", async () => {
    expect((await reserver(randomUUID(), "2030-10-10", "2030-10-12")).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe("Idempotency-Key (double clic, coupure réseau)", () => {
  const avecCle = (categorieId: string, cle: string, identite = CLIENT_A) =>
    appel("post", "/reservations", identite)
      .set("Idempotency-Key", cle)
      .send(demandeReservation(categorieId, "2030-10-10", "2030-10-12"));

  it("la même requête renvoyée donne la même réservation, sans doublon", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    await creerChambre(cat.id, "102");
    const cle = randomUUID();

    const premiere = await avecCle(cat.id, cle);
    const seconde = await avecCle(cat.id, cle);

    expect(premiere.status).toBe(201);
    expect(seconde.status).toBe(201);
    expect(seconde.body.id).toBe(premiere.body.id);
    expect(seconde.headers["idempotent-replayed"]).toBe("true");
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("même clé envoyée deux fois EN MÊME TEMPS : une seule réservation", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    await creerChambre(cat.id, "102");
    const cle = randomUUID();

    const [a, b] = await Promise.all([avecCle(cat.id, cle), avecCle(cat.id, cle)]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("la clé d'un autre utilisateur est refusée (422) : on ne relit pas la réservation d'autrui", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const cle = randomUUID();
    await avecCle(cat.id, cle, CLIENT_A);

    const res = await avecCle(cat.id, cle, CLIENT_B);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CLE_IDEMPOTENCE_REUTILISEE");
  });

  it("une clé qui n'est pas un uuid : 400", async () => {
    const cat = await creerCategorie();
    expect((await avecCle(cat.id, "123")).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe("Outbox : pas de double écriture", () => {
  it("l'événement est écrit avec la réservation… et seulement si elle existe", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");

    const ok = await reserver(cat.id, "2030-10-10", "2030-10-13");
    const refusee = await reserver(cat.id, "2030-10-11", "2030-10-12"); // plus de chambre

    expect(refusee.status).toBe(409);
    const evts = await evenementsOutbox("reservation.creee");
    expect(evts).toHaveLength(1);
    expect(evts[0]?.payload).toMatchObject({
      reservationId: ok.body.id,
      chambreNumero: "101",
      nbNuits: 3,
      montantTotal: 240_000,
      categorieCode: "STANDARD",
    });
    expect(evts[0]?.publieLe).toBeNull();
  });

  it("le relais publie dans la file de chaque abonné, une seule fois même s'il repasse", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    await reserver(cat.id, "2030-10-10", "2030-10-13");
    const [evt] = await evenementsOutbox("reservation.creee");
    const file = bus.file(nomFile("facturation", "reservation.creee"));

    expect(await relayerOutbox()).toBe(1);
    expect(await relayerOutbox()).toBe(0); // déjà marqué publié

    // Plantage simulé entre l'envoi et la mise à jour de publie_le : le relais republie…
    await prisma.outboxEvenement.update({ where: { id: evt?.id }, data: { publieLe: null } });
    expect(await relayerOutbox()).toBe(1);

    // …mais BullMQ n'a qu'UN job, car jobId = id de l'événement
    expect(await file.getJobCounts("waiting", "delayed", "active")).toMatchObject({ waiting: 1 });
    const job = await file.getJob(evt?.id ?? "");
    expect(job?.data).toMatchObject({ id: evt?.id, type: "reservation.creee" });
  });
});

// ---------------------------------------------------------------------------
describe("Expiration à 30 minutes", () => {
  const creerEnAttente = async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    return { cat, r: await reserver(cat.id, "2030-10-10", "2030-10-12") };
  };

  it("un job différé est planifié à la création", async () => {
    const { r } = await creerEnAttente();
    const job = await bus.file(FILE_EXPIRATIONS).getJob(`expiration-${r.body.id}`);

    expect(job).toBeDefined();
    expect(await job?.getState()).toBe("delayed");
    expect(job?.opts.delay).toBeGreaterThan(29 * 60 * 1000);
  });

  it("exécuté trop tôt, le job ne fait rien ; après l'échéance, il annule et libère la chambre", async () => {
    const { cat, r } = await creerEnAttente();

    expect(await expirerReservation(r.body.id)).toBe(false);
    expect((await lire(r.body.id)).statut).toBe("EN_ATTENTE_PAIEMENT");

    await prisma.reservation.update({ where: { id: r.body.id }, data: { expireLe: new Date(Date.now() - 1000) } });
    expect(await expirerReservation(r.body.id)).toBe(true);
    expect((await lire(r.body.id)).statut).toBe("ANNULEE");

    // La chambre est de nouveau disponible
    expect((await reserver(cat.id, "2030-10-10", "2030-10-12")).status).toBe(201);
  });

  it("le paiement supprime le job, et un job qui passerait quand même ne touche pas la réservation payée", async () => {
    const { r } = await creerEnAttente();

    await confirmer(r.body.id);

    expect(await bus.file(FILE_EXPIRATIONS).getJob(`expiration-${r.body.id}`)).toBeUndefined();
    // Même si le job n'avait pas pu être supprimé (Redis coupé) :
    await prisma.reservation.update({ where: { id: r.body.id }, data: { expireLe: new Date(Date.now() - 1000) } });
    expect(await expirerReservation(r.body.id)).toBe(false);
    expect((await lire(r.body.id)).statut).toBe("CONFIRMEE");
  });

  it("le balayage rattrape les réservations dont le job a été perdu", async () => {
    const { r } = await creerEnAttente();
    await bus.file(FILE_EXPIRATIONS).obliterate({ force: true }); // job perdu
    await prisma.reservation.update({ where: { id: r.body.id }, data: { expireLe: new Date(Date.now() - 1000) } });

    expect(await balayerExpirations()).toBe(1);
    expect((await lire(r.body.id)).statut).toBe("ANNULEE");
  });
});

// ---------------------------------------------------------------------------
describe("Consommateur paiement.recu", () => {
  const paiement = (reservationId: string) =>
    enveloppe("paiement.recu", {
      paiementId: randomUUID(),
      factureId: randomUUID(),
      reservationId,
      commandeId: null,
      montant: 160_000,
    });

  it("confirme la réservation une seule fois, même si l'événement arrive deux fois", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, "2030-10-10", "2030-10-12");
    const evt = paiement(r.body.id);

    await traiterPaiementRecu(evt);
    await traiterPaiementRecu(evt); // doublon

    const apres = await lire(r.body.id);
    expect(apres.statut).toBe("CONFIRMEE");
    expect(apres.version).toBe(2);
    expect(await evenementsOutbox("reservation.confirmee")).toHaveLength(1);
    expect(await prisma.evenementTraite.count()).toBe(1);
    expect(await bus.file(FILE_EXPIRATIONS).getJob(`expiration-${r.body.id}`)).toBeUndefined();
  });

  it("paiement arrivé après l'expiration : pas de confirmation, pas de réessai inutile", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, "2030-10-10", "2030-10-12");
    await prisma.reservation.update({ where: { id: r.body.id }, data: { statut: "ANNULEE" } });

    await expect(traiterPaiementRecu(paiement(r.body.id))).resolves.toBeUndefined();
    expect((await lire(r.body.id)).statut).toBe("ANNULEE");
    expect(await prisma.evenementTraite.count()).toBe(1); // marqué traité : BullMQ ne réessaiera pas
  });

  it("de bout en bout dans BullMQ : publié par le bus, lu par le worker", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, "2030-10-10", "2030-10-12");
    const evt = paiement(r.body.id);
    const worker = bus.consommer("hebergement", "paiement.recu", traiterPaiementRecu);

    await bus.publier({ id: evt.id, type: evt.type, payload: evt.payload, createdAt: new Date() });

    for (let i = 0; i < 50 && (await lire(r.body.id)).statut !== "CONFIRMEE"; i++) {
      await new Promise((ok) => setTimeout(ok, 100));
    }
    await worker.close();
    expect((await lire(r.body.id)).statut).toBe("CONFIRMEE");
  });
});

// ---------------------------------------------------------------------------
describe("Check-in, check-out et machine à états", () => {
  // Réservation confirmée qui commence aujourd'hui
  const sejourDuJour = async (etat: "PROPRE" | "SALE" = "PROPRE") => {
    const cat = await creerCategorie();
    const chambre = await creerChambre(cat.id, "101", etat);
    const r = await reserver(cat.id, jour(0), jour(2));
    await confirmer(r.body.id);
    return { cat, chambre, id: r.body.id as string };
  };
  const checkIn = (id: string, corps: object = { pieceIdentiteVerifiee: true }) =>
    appel("post", `/reservations/${id}/check-in`, RECEPTION).send(corps);

  it("check-in refusé tant que la réservation n'est pas payée", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, jour(0), jour(2));

    const res = await checkIn(r.body.id);
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("EN_ATTENTE_PAIEMENT → EN_COURS");
  });

  it("la pièce d'identité doit être déclarée vérifiée", async () => {
    const { id } = await sejourDuJour();
    expect((await checkIn(id, {})).status).toBe(400);
  });

  it("pas de check-in avant le jour d'arrivée", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    const r = await reserver(cat.id, jour(3), jour(5));
    await confirmer(r.body.id);

    expect((await checkIn(r.body.id)).status).toBe(422);
  });

  it("chambre SALE : refusé ; réattribution à une chambre PROPRE de la même catégorie : accepté", async () => {
    const { cat, id } = await sejourDuJour("SALE");
    const propre = await creerChambre(cat.id, "102", "PROPRE");

    const refus = await checkIn(id);
    expect(refus.status).toBe(422);
    expect(refus.body.message).toContain("n'est pas propre");

    const ok = await checkIn(id, { pieceIdentiteVerifiee: true, chambreId: propre.id });
    expect(ok.status).toBe(200);
    expect(ok.body.statut).toBe("EN_COURS");
    expect(ok.body.chambreId).toBe(propre.id);

    const [evt] = await evenementsOutbox("sejour.commence");
    expect(evt?.payload).toMatchObject({ reservationId: id, chambreNumero: "102" });
  });

  it("réattribution vers une autre catégorie : refusée", async () => {
    const { id } = await sejourDuJour();
    const suite = await creerCategorie("SUITE_PRESTIGE", 300_000);
    const autre = await creerChambre(suite.id, "501");

    expect((await checkIn(id, { pieceIdentiteVerifiee: true, chambreId: autre.id })).status).toBe(422);
  });

  it("réattribution vers une chambre déjà occupée sur ces dates : 409 (contrainte EXCLUDE)", async () => {
    const { cat, id } = await sejourDuJour("SALE");
    await creerChambre(cat.id, "102", "PROPRE");
    // La 102 est prise aujourd'hui par un autre client
    const autre = await reserver(cat.id, jour(0), jour(1));
    const occupee = autre.body.chambreId as string;

    const res = await checkIn(id, { pieceIdentiteVerifiee: true, chambreId: occupee });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CHAMBRE_INDISPONIBLE");
  });

  it("check-out : séjour TERMINEE, chambre SALE, événement sejour.termine avec le nombre de nuits", async () => {
    const { chambre, id } = await sejourDuJour();
    await checkIn(id);

    const res = await appel("post", `/reservations/${id}/check-out`, RECEPTION);

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe("TERMINEE");
    expect((await prisma.chambre.findUniqueOrThrow({ where: { id: chambre.id } })).etatMenage).toBe("SALE");
    const [evt] = await evenementsOutbox("sejour.termine");
    expect(evt?.payload).toMatchObject({ reservationId: id, chambreNumero: "101", nbNuits: 2 });
  });

  it("toute transition absente du diagramme est refusée", async () => {
    const { id } = await sejourDuJour();
    expect((await appel("post", `/reservations/${id}/check-out`, RECEPTION)).status).toBe(422); // CONFIRMEE → TERMINEE

    await checkIn(id);
    expect((await appel("post", `/reservations/${id}/annuler`, RECEPTION)).status).toBe(422); // EN_COURS → ANNULEE
    await appel("post", `/reservations/${id}/check-out`, RECEPTION);
    expect((await appel("post", `/reservations/${id}/check-out`, RECEPTION)).status).toBe(422); // TERMINEE → TERMINEE
  });

  it("annuler une réservation confirmée libère la chambre", async () => {
    const { cat, id } = await sejourDuJour();

    const res = await appel("post", `/reservations/${id}/annuler`, RECEPTION);
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe("ANNULEE");
    expect((await reserver(cat.id, jour(0), jour(2))).status).toBe(201);
  });

  it("départs du jour et séjour en cours dans une chambre (appel interne du restaurant)", async () => {
    const { id } = await sejourDuJour();
    await checkIn(id);
    // Séjour d'hier à aujourd'hui (départ > arrivée : la contrainte CHECK l'exige)
    await prisma.reservation.update({ where: { id }, data: { dateArrivee: new Date(jour(-1)), dateDepart: new Date(jour(0)) } });

    const departs = await appel("get", "/reservations/departs", RECEPTION);
    expect(departs.body.map((r: { id: string }) => r.id)).toEqual([id]);

    const enCours = await appel("get", "/interne/reservations/en-cours?chambre=101");
    expect(enCours.status).toBe(200);
    expect(enCours.body.id).toBe(id);
    expect((await appel("get", "/interne/reservations/en-cours?chambre=999")).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe("Consommateur menage.termine", () => {
  it("la chambre redevient PROPRE, une seule fois même si l'événement est rejoué", async () => {
    const cat = await creerCategorie();
    const chambre = await creerChambre(cat.id, "101", "SALE");
    const evt = enveloppe("menage.termine", {
      tacheId: randomUUID(),
      chambreId: chambre.id,
      chambreNumero: "101",
      articles: [{ code: "GEL_DOUCHE", quantite: 2 }],
    });

    await traiterMenageTermine(evt);
    await traiterMenageTermine(evt);

    const apres = await prisma.chambre.findUniqueOrThrow({ where: { id: chambre.id } });
    expect(apres.etatMenage).toBe("PROPRE");
    expect(apres.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe("Réservations d'un CLIENT", () => {
  it("rattachée à son compte, canal SITE_WEB, visible par lui seul", async () => {
    const cat = await creerCategorie();
    await creerChambre(cat.id, "101");
    await creerChambre(cat.id, "102");
    const a = await reserver(cat.id, "2030-10-10", "2030-10-12", CLIENT_A);
    await reserver(cat.id, "2030-10-10", "2030-10-12", CLIENT_B);

    expect(a.body.clientId).toBe(CLIENT_A.id);
    expect(a.body.canal).toBe("SITE_WEB");

    const mes = await appel("get", "/reservations/mes-reservations", CLIENT_A);
    expect(mes.body.map((r: { id: string }) => r.id)).toEqual([a.body.id]);

    expect((await appel("get", `/reservations/${a.body.id}`, CLIENT_A)).status).toBe(200);
    expect((await appel("get", `/reservations/${a.body.id}`, CLIENT_B)).status).toBe(404);
    expect((await appel("get", `/reservations/${a.body.id}`, RECEPTION)).status).toBe(200);
  });
});
