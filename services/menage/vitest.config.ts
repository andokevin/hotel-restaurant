import { defineConfig } from "vitest/config";

// Base DÉDIÉE aux tests (vidée à chaque test), jamais la base de dev.
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de .env (CI) : DATABASE_URL doit être fournie par l'environnement.
}
const url = new URL(process.env.DATABASE_URL ?? "postgresql://hotel:hotel@localhost:5432/menage_db");
url.pathname = "/menage_test_db";
process.env.DATABASE_URL = url.toString();

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: url.toString(),
      NODE_ENV: "test",
      CLE_INTERNE: "cle-interne-de-test-0123456789",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6381",
      BULLMQ_PREFIXE: "hotel-test",
      AUTH_URL: "http://127.0.0.1:1", // auth injoignable en test : le nom reste vide, la tâche avance quand même
    },
    globalSetup: ["./tests/preparation-globale.ts"],
    fileParallelism: false,
  },
});
