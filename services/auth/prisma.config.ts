import { defineConfig, env } from "prisma/config";

// En dev, les variables viennent de .env ; dans Docker, de l'environnement du conteneur
// (il n'y a pas de fichier .env : loadEnvFile lèverait une erreur).
try {
  process.loadEnvFile();
} catch {
  // pas de .env : on utilise l'environnement tel quel
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
