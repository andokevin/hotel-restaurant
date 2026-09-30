import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLE_INTERNE: z.string().min(16),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIXE: z.string().default("hotel"),
  // Papi.mg : API « payment-links », celle qu'utilise Reclamia en production (rapport D1)
  PAPI_BASE_URL: z.url().default("https://app.papi.mg"),
  PAPI_API_KEY: z.string().min(1),
  // true tant qu'on développe : Papi ne débite personne
  PAPI_MODE_TEST: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  // Adresse publique de la GATEWAY (en dev : l'URL donnée par cloudflared). Papi y envoie les notifications.
  PUBLIC_URL: z.url(),
  // Où le client revient après le paiement (page qui INTERROGE le statut, jamais une preuve)
  FRONT_URL: z.url(),
  HEBERGEMENT_URL: z.url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}
export const env = parsed.data;
