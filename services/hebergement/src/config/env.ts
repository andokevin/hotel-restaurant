import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Secret partagé avec les autres services pour les routes /interne
  CLE_INTERNE: z.string().min(16),
  REDIS_URL: z.string().min(1),
  // Préfixe des clés BullMQ dans Redis (les tests utilisent le leur)
  BULLMQ_PREFIXE: z.string().default("hotel"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
