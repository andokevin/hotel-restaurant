import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLE_INTERNE: z.string().min(16),
  // Clé PUBLIQUE Ed25519 (PEM en base64) : permet de vérifier un JWT, pas d'en fabriquer.
  JWT_CLE_PUBLIQUE: z.string().min(1),
  // Seule origine autorisée à appeler l'API depuis un navigateur (CORS)
  FRONT_URL: z.url().default("http://localhost:5173"),
  // Adresses des services (réseau interne Docker en production)
  AUTH_URL: z.url(),
  HEBERGEMENT_URL: z.url(),
  FACTURATION_URL: z.url(),
  // Tentatives de connexion par IP et par fenêtre de 15 minutes
  LIMITE_CONNEXIONS: z.coerce.number().int().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
