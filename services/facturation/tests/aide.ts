import { randomUUID } from "node:crypto";
import request from "supertest";
import { ABONNEMENTS, nomFile, type ContenuEvenement, type Enveloppe, type Identite, type TypeEvenement } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import { FILE_NOTIFICATIONS } from "../src/modules/paiement/paiement.service.js";
import { faux } from "./faux-services.js";

export const viderBase = () =>
  prisma.$executeRawUnsafe(
    `TRUNCATE ligne_facture, paiement, facture, compteur_facture, outbox_evenement, evenement_traite CASCADE`,
  );

export const toutReinitialiser = async () => {
  await viderBase();
  faux.reinitialiser();
  const noms = [FILE_NOTIFICATIONS];
  for (const type of Object.keys(ABONNEMENTS) as TypeEvenement[]) {
    for (const c of ABONNEMENTS[type]) noms.push(nomFile(c, type));
  }
  await Promise.all(noms.map((n) => bus.file(n).obliterate({ force: true })));
};

export const CLIENT_A: Identite = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "CLIENT" };
export const CLIENT_B: Identite = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "CLIENT" };
export const RECEPTION: Identite = { id: "11111111-1111-4111-8111-111111111111", role: "RECEPTIONNISTE" };

// Simule la gateway : clé interne toujours présente, identité si fournie.
export const appel = (methode: "get" | "post", chemin: string, identite?: Identite) => {
  const r = request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "");
  return identite ? r.set("x-utilisateur-id", identite.id).set("x-utilisateur-role", identite.role) : r;
};

export const enveloppe = <T extends TypeEvenement>(type: T, payload: ContenuEvenement<T>): Enveloppe<T> => ({
  id: randomUUID(),
  type,
  emisLe: new Date().toISOString(),
  payload,
});

// Contenu de reservation.creee : 3 nuits à 80 000 Ar pour le CLIENT_A
export const reservationCreee = (surcharge: Partial<ContenuEvenement<"reservation.creee">> = {}) =>
  enveloppe("reservation.creee", {
    reservationId: randomUUID(),
    reference: "RES-2026-000042",
    clientId: CLIENT_A.id,
    clientNom: "Rakoto Jean",
    clientTelephone: "0341234567",
    clientEmail: "rakoto@mail.mg",
    langue: "FR",
    categorieCode: "STANDARD",
    chambreNumero: "101",
    dateArrivee: "2030-10-10",
    dateDepart: "2030-10-13",
    nbNuits: 3,
    nbAdultes: 2,
    nbEnfants: 0,
    montantTotal: 240_000,
    expireLe: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...surcharge,
  });

// Les nuitées d'un séjour du 2030-10-10, une par tarif donné : nuitees(80_000, 80_000, [120_000, "Haute saison"])
export const nuitees = (...tarifs: (number | [number, string])[]) =>
  tarifs.map((t, i) => {
    const [tarifApplique, saison] = typeof t === "number" ? [t, null] : t;
    return { nuit: `2030-10-${String(10 + i).padStart(2, "0")}`, tarifApplique, saison };
  });

// Nuitées telles que hebergement les expose en REST. Ancien format d'événement (sans nuitées) :
// on les reconstitue à parts égales, le reste de la division sur la 1re nuit.
const nuiteesExposees = (p: ContenuEvenement<"reservation.creee">) => {
  const base = Math.floor(p.montantTotal / p.nbNuits);
  const liste =
    p.nuitees ??
    Array.from({ length: p.nbNuits }, (_, i) => ({
      nuit: `2030-10-${String(10 + i).padStart(2, "0")}`,
      tarifApplique: i === 0 ? p.montantTotal - base * (p.nbNuits - 1) : base,
      saison: null,
    }));
  return liste.map((n) => ({
    nuit: `${n.nuit}T00:00:00.000Z`,
    tarifApplique: n.tarifApplique,
    saison: n.saison === null ? null : { nom: { fr: n.saison } },
  }));
};

// La même réservation, telle que la renvoie GET /interne/reservations/:id de hebergement
export const exposerReservation = (evt: Enveloppe<"reservation.creee">, statut = "EN_ATTENTE_PAIEMENT") => {
  const p = evt.payload;
  faux.reservations.set(p.reservationId, {
    id: p.reservationId,
    reference: p.reference,
    statut,
    clientId: p.clientId,
    clientNom: p.clientNom,
    clientEmail: p.clientEmail,
    clientTelephone: p.clientTelephone,
    langue: p.langue,
    montantTotal: p.montantTotal,
    dateArrivee: `${p.dateArrivee}T00:00:00.000Z`,
    dateDepart: `${p.dateDepart}T00:00:00.000Z`,
    chambre: { numero: p.chambreNumero, categorie: { code: p.categorieCode } },
    nuitees: nuiteesExposees(p),
  });
};

// Rejoue ce que ferait Papi : POST sur la notificationUrl qu'on lui a donnée (derrière la gateway, sans /api).
export const notifier = (notificationUrl: string, corps: Record<string, unknown>) => {
  const u = new URL(notificationUrl);
  return appel("post", `${u.pathname.replace(/^\/api/, "")}${u.search}`).send(corps);
};

// La dernière demande de lien reçue par le faux Papi
export const derniereDemandePapi = () => {
  const d = faux.papi.demandes.at(-1);
  if (!d) throw new Error("Papi n'a reçu aucune demande");
  return d;
};

export const evenementsOutbox = (type: string) =>
  prisma.outboxEvenement.findMany({ where: { type }, orderBy: { createdAt: "asc" } });
