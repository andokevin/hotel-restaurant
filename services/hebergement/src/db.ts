import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./config/env.js";
import { PrismaClient } from "./generated/prisma/client.js";

// Node met les modules en cache : ce fichier n'est exécuté qu'une fois,
// donc tout le service partage cette même instance.
// env.ts a déjà vérifié que DATABASE_URL est présente.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
