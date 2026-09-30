import { generateKeyPairSync } from "node:crypto";
import { defineConfig } from "vitest/config";

// Paire de clés jetable : les tests signent leurs propres jetons avec la clé privée,
// la gateway les vérifie avec la clé publique, exactement comme en vrai.
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const b64 = (pem: string | Buffer) => Buffer.from(pem).toString("base64");

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      CLE_INTERNE: "cle-interne-de-test-0123456789",
      JWT_CLE_PUBLIQUE: b64(publicKey.export({ type: "spki", format: "pem" })),
      JWT_CLE_PRIVEE_TEST: b64(privateKey.export({ type: "pkcs8", format: "pem" })),
      LIMITE_CONNEXIONS: "3",
      // Remplacées par les adresses des faux services démarrés dans les tests
      AUTH_URL: "http://127.0.0.1:1",
      HEBERGEMENT_URL: "http://127.0.0.1:1",
    },
  },
});
