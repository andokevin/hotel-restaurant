#!/usr/bin/env bash
# Crée le fichier .env à la racine, lu par docker compose (profil app). Ne l'écrase jamais.
set -eu
if [ -f .env ]; then echo ".env existe déjà : rien n'est modifié." >&2; exit 1; fi
CLES=$(node -e '
  const { generateKeyPairSync } = require("node:crypto");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const b64 = (k, type) => Buffer.from(k.export({ type, format: "pem" })).toString("base64");
  console.log("JWT_CLE_PRIVEE=" + b64(privateKey, "pkcs8"));
  console.log("JWT_CLE_PUBLIQUE=" + b64(publicKey, "spki"));
')
cat > .env <<ENV
# Généré par scripts/generer-env-docker.sh — SECRET, ne jamais commiter (.env est dans .gitignore)
CLE_INTERNE=$(openssl rand -hex 32)
$CLES

# Paiement : par défaut, le faux Papi du compose (démonstration, aucune vraie transaction).
# Avec le vrai Papi (mode test) : décommenter, et mettre l'URL du tunnel cloudflared dans PUBLIC_URL.
# PAPI_BASE_URL=https://app.papi.mg
# PAPI_API_KEY=ta-cle-papi
# PUBLIC_URL=https://xxx.trycloudflare.com
ENV
echo ".env créé (CLE_INTERNE et clés JWT générées)."
