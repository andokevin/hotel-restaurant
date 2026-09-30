import { defineConfig } from "vitest/config";

// Les tests tournent sur une base DÉDIÉE (hebergement_test_db), jamais sur la base de dev :
// chaque test la vide. On reprend l'URL du .env et on ne change que le nom de la base.
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de .env (CI) : DATABASE_URL doit alors être fournie par l'environnement.
}

const url = new URL(process.env.DATABASE_URL ?? "postgresql://hotel:hotel@localhost:5432/hebergement_db");
url.pathname = "/hebergement_test_db";

// Visible par preparation-globale.ts (même processus) et par les tests (via test.env).
process.env.DATABASE_URL = url.toString();

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: url.toString(),
      NODE_ENV: "test",
      CLE_INTERNE: "cle-interne-de-test-0123456789",
    },
    globalSetup: ["./tests/preparation-globale.ts"],
    // Tous les fichiers partagent la même base : on les exécute l'un après l'autre.
    fileParallelism: false,
  },
});
