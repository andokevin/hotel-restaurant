import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3006),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLE_INTERNE: z.string().min(16),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIXE: z.string().default("hotel"),
  HEBERGEMENT_URL: z.url(),
  FACTURATION_URL: z.url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}
export const env = parsed.data;
