#!/bin/sh
# Démarrage d'un service dans l'image unique : SERVICE=auth, hebergement…
# 1. appliquer les migrations existantes (migrate DEPLOY : jamais de génération ni de réinitialisation)
# 2. lancer le serveur compilé
set -e
: "${SERVICE:?La variable SERVICE est obligatoire}"
cd "/app/services/$SERVICE"
if [ -f prisma/schema.prisma ]; then pnpm exec prisma migrate deploy; fi
exec node dist/server.js
