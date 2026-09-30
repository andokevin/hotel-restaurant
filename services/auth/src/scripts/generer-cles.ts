import { generateKeyPairSync } from "node:crypto";

// Génère une paire de clés Ed25519 pour signer / vérifier les JWT.
// Usage : pnpm --filter @hotel/auth generer-cles
const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const pem = {
  privee: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  publique: publicKey.export({ type: "spki", format: "pem" }).toString(),
};

// En base64 pour tenir sur une seule ligne de .env
console.log("# À copier dans services/auth/.env (SECRET, ne jamais commiter) :");
console.log(`JWT_CLE_PRIVEE=${Buffer.from(pem.privee).toString("base64")}`);
console.log("");
console.log("# À copier dans services/api-gateway/.env (publique, peut être partagée) :");
console.log(`JWT_CLE_PUBLIQUE=${Buffer.from(pem.publique).toString("base64")}`);
