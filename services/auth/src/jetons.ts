import { createHash, randomBytes } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { JWT_ALGORITHME, JWT_AUDIENCE, JWT_EMETTEUR, type Role } from "@hotel/commun";
import { env } from "./config/env.js";

export const DUREE_ACCES_SECONDES = 15 * 60;
export const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

// La clé privée ne sort jamais de ce service : lui seul peut SIGNER un jeton.
// La gateway n'a que la clé publique : elle peut VÉRIFIER, pas fabriquer.
const clePrivee = importPKCS8(Buffer.from(env.JWT_CLE_PRIVEE, "base64").toString("utf8"), JWT_ALGORITHME);

// Jeton d'accès : un JWT court (15 min) que la gateway vérifie sans appeler la base.
export const signerJetonAcces = async (utilisateur: { id: string; role: Role }) =>
  new SignJWT({ role: utilisateur.role })
    .setProtectedHeader({ alg: JWT_ALGORITHME })
    .setSubject(utilisateur.id)
    .setIssuer(JWT_EMETTEUR)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${DUREE_ACCES_SECONDES}s`)
    .sign(await clePrivee);

// Jeton de rafraîchissement : une simple valeur aléatoire (pas un JWT), stockée hachée en base.
// 32 octets = 256 bits de hasard : impossible à deviner.
export const nouveauJetonSession = () => randomBytes(32).toString("base64url");

// SHA-256 suffit ici (contrairement aux mots de passe) : le jeton est déjà totalement aléatoire,
// il n'y a rien à « deviner » par force brute.
export const hacherJeton = (jeton: string) => createHash("sha256").update(jeton).digest("hex");
