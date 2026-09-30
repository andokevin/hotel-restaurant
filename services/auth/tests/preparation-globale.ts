import { execSync } from "node:child_process";

// Exécuté une seule fois avant tous les tests : applique les migrations
// (y compris la contrainte EXCLUDE, écrite à la main) sur la base de test.
// `migrate deploy` n'applique que les migrations existantes, sans rien générer ni réinitialiser.
export default function preparer() {
  execSync("pnpm exec prisma migrate deploy", { stdio: "pipe", env: process.env });
}
