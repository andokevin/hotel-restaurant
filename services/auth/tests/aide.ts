import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { hacherMotDePasse } from "../src/mot-de-passe.js";
import type { Role } from "@hotel/commun";

export const viderBase = () => prisma.$executeRawUnsafe(`TRUNCATE session, utilisateur CASCADE`);

// Simule la gateway : clé interne toujours présente, identité si on en fournit une.
export const appel = (methode: "get" | "post" | "patch", chemin: string, identite?: { id: string; role: Role }) => {
  const r = request(app)[methode](chemin).set("x-cle-interne", process.env.CLE_INTERNE ?? "");
  return identite ? r.set("x-utilisateur-id", identite.id).set("x-utilisateur-role", identite.role) : r;
};

export const MOT_DE_PASSE = "Tsara-Be-2026!";

export const creerCompte = async (telephone: string, role: Role = "CLIENT", actif = true, email = `${telephone}@test.mg`) =>
  prisma.utilisateur.create({
    data: { telephone, email, nom: "Rasoa Voahangy", role, actif, motDePasseHash: await hacherMotDePasse(MOT_DE_PASSE) },
  });

// Extrait "hotel_session=<valeur>" de l'en-tête Set-Cookie
export const cookieSession = (res: request.Response): string => {
  const brut = res.headers["set-cookie"];
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  const cookie = liste.find((c) => c.startsWith("hotel_session="));
  if (!cookie) throw new Error("Pas de cookie hotel_session dans la réponse");
  return cookie.split(";")[0] ?? "";
};
