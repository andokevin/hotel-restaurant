import { defineConfig } from "vitest/config";

// Base DÉDIÉE aux tests (vidée à chaque test), jamais la base de dev.
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de .env (CI) : DATABASE_URL doit être fournie par l'environnement.
}
const url = new URL(process.env.DATABASE_URL ?? "postgresql://hotel:hotel@localhost:5432/facturation_db");
url.pathname = "/facturation_test_db";
process.env.DATABASE_URL = url.toString();

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: url.toString(),
      NODE_ENV: "test",
      CLE_INTERNE: "cle-interne-de-test-0123456789",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6381",
      BULLMQ_PREFIXE: "hotel-test-facturation", // un préfixe PAR service : les suites tournent en parallèle et vident leurs files
      // Jamais la vraie clé Papi en test : un faux Papi local répond (tests/faux-services.ts)
      PAPI_API_KEY: "cle-papi-de-test",
      PAPI_MODE_TEST: "true",
      PUBLIC_URL: "https://passerelle.test",
      FRONT_URL: "http://front.test",
      // Remplacées par les adresses des faux services au démarrage
      PAPI_BASE_URL: "http://127.0.0.1:1",
      HEBERGEMENT_URL: "http://127.0.0.1:1",
    },
    globalSetup: ["./tests/preparation-globale.ts"],
    setupFiles: ["./tests/faux-services.ts"],
    fileParallelism: false,
  },
});
