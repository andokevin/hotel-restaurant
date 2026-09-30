import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PAPI_BASE_URL: z.url(),
  PAPI_API_KEY: z.string().min(1),
  PUBLIC_URL: z.url(),
  FRONT_URL: z.url(),
  HEBERGEMENT_URL: z.url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}
export const env = parsed.data;