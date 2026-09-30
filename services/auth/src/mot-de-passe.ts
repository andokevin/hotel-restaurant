import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { env } from "./config/env.js";

// scrypt est volontairement LENT et GOURMAND EN MÉMOIRE : tester un milliard de mots de passe
// devient hors de prix, même avec des cartes graphiques. Il est intégré à Node (pas de module natif).
const R = 8; // taille de bloc
const P = 1; // parallélisme
const LONGUEUR = 64; // octets d'empreinte
const MEMOIRE_MAX = 256 * 1024 * 1024; // N=2^17, r=8 demande ~128 Mo ; la limite par défaut de Node est 32 Mo

const deriver = (motDePasse: string, sel: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resoudre, rejeter) => {
    scrypt(motDePasse, sel, LONGUEUR, { N: n, r, p, maxmem: MEMOIRE_MAX }, (err, cle) =>
      err ? rejeter(err) : resoudre(cle),
    );
  });

// Format stocké : scrypt$N$r$p$sel$empreinte (sel et empreinte en base64).
// Les paramètres voyagent avec le hash : on pourra augmenter N plus tard sans casser les anciens comptes.
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  // Un sel aléatoire par utilisateur : deux personnes avec le même mot de passe
  // ont des empreintes différentes, et les tables précalculées ne servent à rien.
  const sel = randomBytes(16);
  const empreinte = await deriver(motDePasse, sel, env.SCRYPT_N, R, P);
  return ["scrypt", env.SCRYPT_N, R, P, sel.toString("base64"), empreinte.toString("base64")].join("$");
}

export async function verifierMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const [algo, n, r, p, sel, empreinte] = stocke.split("$");
  if (algo !== "scrypt" || !n || !r || !p || !sel || !empreinte) return false;

  const attendue = Buffer.from(empreinte, "base64");
  const calculee = await deriver(motDePasse, Buffer.from(sel, "base64"), Number(n), Number(r), Number(p));
  // Comparaison en temps constant (les deux tampons font LONGUEUR octets)
  return calculee.length === attendue.length && timingSafeEqual(calculee, attendue);
}

// Hash d'un mot de passe bidon, calculé une seule fois. Quand l'email est inconnu, on vérifie
// quand même contre ce hash : la réponse prend le même temps que pour un vrai compte, et un
// attaquant ne peut pas découvrir quels emails ont un compte en chronométrant les réponses.
let hashFactice: Promise<string> | undefined;
export const obtenirHashFactice = () => (hashFactice ??= hacherMotDePasse("mot-de-passe-factice"));
