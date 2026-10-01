import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLE_INTERNE: z.string().min(16),
  // Clé privée Ed25519 au format PEM, encodée en base64 pour tenir sur une ligne.
  // Générée par : pnpm --filter @hotel/auth generer-cles
  JWT_CLE_PRIVEE: z.string().min(1),
  // Coût de scrypt (puissance de 2). 131072 = 2^17, valeur recommandée par l'OWASP.
  // Les tests le baissent pour aller vite : le coût est stocké dans chaque hash, donc
  // un hash calculé avec un coût reste vérifiable même si la valeur change ensuite.
  SCRYPT_N: z.coerce.number().int().default(131072),
  // Chemin du cookie VU PAR LE NAVIGATEUR, c'est-à-dire derrière la gateway
  COOKIE_CHEMIN: z.string().default("/api/auth"),
  // Cookie « Secure » : envoyé seulement en HTTPS. Par défaut : oui en production.
  // À mettre à false pour une démo en HTTP sur le réseau local (http://192.168.x.x:8080).
  COOKIE_SECURISE: z.enum(["true", "false"]).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
