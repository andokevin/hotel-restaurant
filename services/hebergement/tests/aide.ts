import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

// Remet la base à zéro entre deux tests. CASCADE suit les clés étrangères.
export const viderBase = () =>
  prisma.$executeRawUnsafe(
    `TRUNCATE reservation_nuitee, reservation, tarif_saison, saison, chambre, categorie_chambre, compteur_reservation CASCADE`,
  );

export const creerChambre = async (numero = "101") => {
  const categorie = await prisma.categorieChambre.upsert({
    where: { code: "STANDARD" },
    update: {},
    create: { code: "STANDARD", libelle: { fr: "Standard" }, capacite: 2, tarifNuit: 80_000 },
  });
  return prisma.chambre.create({ data: { numero, etage: 1, categorieId: categorie.id } });
};

// Corps valide de POST /reservations ; les dates sont en 2030 pour rester dans le futur.
export const demandeReservation = (chambreId: string, dateArrivee: string, dateDepart: string) => ({
  chambreId,
  clientNom: "Rakoto Jean",
  clientTelephone: "0341234567",
  pieceIdentiteType: "CIN",
  pieceIdentiteNumero: "101201304405",
  dateArrivee,
  dateDepart,
});

// Simule la gateway : la clé interne est toujours présente.
export const appel = (methode: "get" | "post" | "patch", chemin: string) =>
  request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "");
