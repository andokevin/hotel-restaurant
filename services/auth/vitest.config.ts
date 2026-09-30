import { generateKeyPairSync } from "node:crypto";
import { defineConfig } from "vitest/config";

// Base DÉDIÉE aux tests (vidée à chaque test), jamais la base de dev.
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de .env (CI) : DATABASE_URL doit être fournie par l'environnement.
}
const url = new URL(process.env.DATABASE_URL ?? "postgresql://hotel:hotel@localhost:5432/auth_db");
url.pathname = "/auth_test_db";
process.env.DATABASE_URL = url.toString();

// Paire de clés jetable, générée à chaque lancement : les tests n'utilisent jamais la vraie clé.
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const b64 = (pem: string | Buffer) => Buffer.from(pem).toString("base64");

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: url.toString(),
      NODE_ENV: "test",
      CLE_INTERNE: "cle-interne-de-test-0123456789",
      JWT_CLE_PRIVEE: b64(privateKey.export({ type: "pkcs8", format: "pem" })),
      JWT_CLE_PUBLIQUE_TEST: b64(publicKey.export({ type: "spki", format: "pem" })),
      SCRYPT_N: "1024", // 2^10 : hachage rapide en test (2^17 en vrai)
    },
    globalSetup: ["./tests/preparation-globale.ts"],
    fileParallelism: false,
  },
});
