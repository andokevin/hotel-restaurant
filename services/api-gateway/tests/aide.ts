import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { importPKCS8, SignJWT } from "jose";
import { JWT_AUDIENCE, JWT_EMETTEUR, type Role } from "@hotel/commun";

// Faux service : renvoie ce qu'il a reçu, pour vérifier ce que la gateway transmet.
export async function demarrerServiceEcho(nom: string): Promise<{ url: string; serveur: Server }> {
  const app = express();
  app.use(express.json());
  app.use((req, res) => {
    res.json({
      service: nom,
      methode: req.method,
      chemin: req.originalUrl,
      corps: req.body ?? null,
      cleInterne: req.get("x-cle-interne") ?? null,
      utilisateurId: req.get("x-utilisateur-id") ?? null,
      role: req.get("x-utilisateur-role") ?? null,
    });
  });
  const serveur = await new Promise<Server>((ok) => {
    const s = app.listen(0, () => ok(s)); // port 0 : le système choisit un port libre
  });
  return { url: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`, serveur };
}

const clePrivee = () => importPKCS8(Buffer.from(process.env.JWT_CLE_PRIVEE_TEST ?? "", "base64").toString("utf8"), "EdDSA");

export const ID_UTILISATEUR = "7b1f3c2a-9d4e-4f5a-8b6c-1d2e3f4a5b6c";

// expireDans : durée ("15m") ou horodatage Unix en secondes (dans le passé pour un jeton expiré)
type OptionsJeton = { role: Role; expireDans?: string | number; audience?: string };

// Fabrique un jeton comme le ferait le service auth
export const jeton = async ({ role, expireDans = "15m", audience = JWT_AUDIENCE }: OptionsJeton) =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(ID_UTILISATEUR)
    .setIssuer(JWT_EMETTEUR)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expireDans)
    .sign(await clePrivee());
