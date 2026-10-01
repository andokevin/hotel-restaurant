# syntax=docker/dockerfile:1
# UNE image pour les 8 services : chaque conteneur choisit le sien avec la variable SERVICE.
# (Une image par service pesait ~900 Mo × 8 ; ici ~1,2 Go au total, construite une seule fois.)
FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app

# Le dépôt, sans node_modules, dist, .env ni code généré (voir .dockerignore)
COPY . .

# Dépendances de tous les services (et de @hotel/commun) ; cache pnpm partagé entre constructions
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "./services/*" --filter "./packages/*"

# Compilation : commun, puis chaque service (prisma generate lit prisma.config.ts, qui exige
# DATABASE_URL : une URL factice suffit, aucune connexion n'est faite à cette étape)
RUN pnpm --filter @hotel/commun build && \
    for d in services/*/; do \
      cd "/app/$d" && \
      if [ -f prisma/schema.prisma ]; then DATABASE_URL=postgresql://construction@localhost/aucune pnpm exec prisma generate; fi && \
      pnpm exec tsc || exit 1; \
    done

# Seulement maintenant : avant l'installation, NODE_ENV=production ferait sauter les devDependencies
# (TypeScript, Prisma CLI) indispensables à la construction.
ENV NODE_ENV=production
CMD ["sh", "/app/docker/demarrer.sh"]
