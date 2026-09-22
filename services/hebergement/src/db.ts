import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est absente : vérifie le fichier .env du service hebergement.",
  );
}

// Node met les modules en cache : ce fichier n'est exécuté qu'une fois,
// donc tout le service partage cette même instance.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
