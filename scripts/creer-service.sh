#!/usr/bin/env bash
# Crée le squelette d'un service à partir de facturation (même structure pour tous).
# Usage : bash scripts/creer-service.sh <nom> <port>
set -eu
NOM=$1; PORT=$2; D=services/$NOM; F=services/facturation
mkdir -p $D/src/config $D/src/modules $D/prisma $D/tests
cat > $D/package.json <<JSON
{
  "name": "@hotel/$NOM",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "build": "tsc",
    "start": "node --env-file=.env dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.tools.json"
  }
}
JSON
cp $F/tsconfig.json $F/prisma.config.ts $F/.gitignore $D/
sed 's/"scripts", //' $F/tsconfig.tools.json > $D/tsconfig.tools.json
cp $F/src/db.ts $F/src/bus.ts $F/src/outbox.ts $D/src/
sed "s/facturation/$NOM/" $F/src/logger.ts > $D/src/logger.ts
sed "s/facturation-service/$NOM-service/" $F/src/server.ts > $D/src/server.ts
cp $F/tests/preparation-globale.ts $D/tests/
sed -e "s/facturation_test_db/${NOM}_test_db/; s/facturation_db/${NOM}_db/" $F/vitest.config.ts \
  | python3 -c "import sys,re; s=sys.stdin.read(); s=re.sub(r'\n      // Jamais la vraie clé Papi.*?HEBERGEMENT_URL: \"http://127.0.0.1:1\",', '', s, flags=re.S); s=s.replace('    setupFiles: [\"./tests/faux-services.ts\"],\n',''); print(s, end='')" > $D/vitest.config.ts
cat > $D/src/config/env.ts <<TS
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default($PORT),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLE_INTERNE: z.string().min(16),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIXE: z.string().default("hotel"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variables d'environnement invalides :", parsed.error.issues);
  process.exit(1);
}
export const env = parsed.data;
TS
{ echo "PORT=$PORT"; echo "DATABASE_URL=postgresql://hotel:hotel@localhost:5432/${NOM}_db"; echo "REDIS_URL=redis://localhost:6381"; grep '^CLE_INTERNE=' services/hebergement/.env; } > $D/.env
{ echo "PORT=$PORT"; echo "DATABASE_URL=postgresql://hotel:hotel@localhost:5432/${NOM}_db"; echo "REDIS_URL=redis://localhost:6381"; echo "# Même valeur dans tous les services. Générer avec : openssl rand -hex 32"; echo "CLE_INTERNE=a-remplacer"; } > $D/.env.example
cat > $D/prisma/schema.prisma <<'PRISMA'
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}

// ---------------------------------------------------------------------------
// Tables techniques (docs/modele-donnees.md, « Mécanismes communs »)
// ---------------------------------------------------------------------------

model OutboxEvenement {
  id        String    @id @default(uuid()) @db.Uuid
  type      String
  payload   Json
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  publieLe  DateTime? @map("publie_le") @db.Timestamptz

  @@index([publieLe, createdAt])
  @@map("outbox_evenement")
}

model EvenementTraite {
  evenementId String   @id @map("evenement_id") @db.Uuid
  traiteLe    DateTime @default(now()) @map("traite_le") @db.Timestamptz

  @@map("evenement_traite")
}
PRISMA
echo "service $NOM créé dans $D"
