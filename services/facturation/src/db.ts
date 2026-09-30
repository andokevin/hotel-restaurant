import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./config/env.js";
import { PrismaClient } from "./generated/prisma/client.js";

// Instance unique partagée par tout le service (les modules Node sont mis en cache).
// env.ts a déjà vérifié que DATABASE_URL est présente.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
