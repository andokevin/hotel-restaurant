import request from "supertest";
import { ABONNEMENTS, aujourdhuiMadagascar, nomFile, type Identite, type TypeEvenement } from "@hotel/commun";
import { app } from "../src/app.js";
import { bus } from "../src/bus.js";
import { prisma } from "../src/db.js";
import type { EtatMenage } from "../src/generated/prisma/client.js";
import { FILE_EXPIRATIONS } from "../src/modules/reservation/expiration.js";

export const viderBase = () =>
  prisma.$executeRawUnsafe(
    `TRUNCATE reservation_nuitee, reservation, tarif_saison, saison, chambre, categorie_chambre,
     compteur_reservation, outbox_evenement, evenement_traite, cle_idempotence CASCADE`,
  );

// Toutes les files BullMQ que hebergement alimente, vidées entre deux tests
export const viderFiles = async () => {
  const noms = [FILE_EXPIRATIONS];
  for (const type of Object.keys(ABONNEMENTS) as TypeEvenement[]) {
    for (const c of ABONNEMENTS[type]) noms.push(nomFile(c, type));
  }
  await Promise.all(noms.map((n) => bus.file(n).obliterate({ force: true })));
};

// Identités « posées par la gateway »
export const RECEPTION: Identite = { id: "11111111-1111-4111-8111-111111111111", role: "RECEPTIONNISTE" };
export const CLIENT_A: Identite = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "CLIENT" };
export const CLIENT_B: Identite = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "CLIENT" };

// Simule la gateway : clé interne toujours présente, identité si fournie.
export const appel = (methode: "get" | "post" | "patch", chemin: string, identite?: Identite) => {
  const r = request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "");
  return identite ? r.set("x-utilisateur-id", identite.id).set("x-utilisateur-role", identite.role) : r;
};

export const creerCategorie = (code: "STANDARD" | "SUITE_SENIOR" | "SUITE_PRESTIGE" = "STANDARD", tarifNuit = 80_000) =>
  prisma.categorieChambre.create({ data: { code, libelle: { fr: code }, capacite: 2, tarifNuit } });

export const creerChambre = (categorieId: string, numero: string, etatMenage: EtatMenage = "PROPRE", horsService = false) =>
  prisma.chambre.create({ data: { numero, etage: Number(numero[0]), categorieId, etatMenage, horsService } });

// "AAAA-MM-JJ" décalé de n jours par rapport à aujourd'hui (heure de Madagascar)
export const jour = (n: number) => {
  const d = new Date(`${aujourdhuiMadagascar()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const demandeReservation = (categorieId: string, dateArrivee: string, dateDepart: string) => ({
  categorieId,
  clientNom: "Rakoto Jean",
  clientTelephone: "0341234567",
  clientEmail: "rakoto@mail.mg",
  pieceIdentiteType: "CIN",
  pieceIdentiteNumero: "101201304405",
  dateArrivee,
  dateDepart,
});

export const reserver = (categorieId: string, arrivee: string, depart: string, identite: Identite = RECEPTION) =>
  appel("post", "/reservations", identite).send(demandeReservation(categorieId, arrivee, depart));

// Événements écrits dans l'outbox, dans l'ordre
export const evenementsOutbox = (type?: string) =>
  prisma.outboxEvenement.findMany({ where: type ? { type } : {}, orderBy: { createdAt: "asc" } });
