# Image d'UN service du monorepo : docker build -f docker/service.Dockerfile --build-arg SERVICE=stock .
FROM node:24-alpine
ARG SERVICE
ENV SERVICE=${SERVICE} NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app

# On copie le dépôt (sans node_modules, dist, .env : voir .dockerignore) puis on n'installe
# que ce dont CE service a besoin (lui + ses dépendances du workspace, ici @hotel/commun).
COPY . .
RUN pnpm install --frozen-lockfile --filter "@hotel/${SERVICE}..."
RUN pnpm --filter @hotel/commun build

WORKDIR /app/services/${SERVICE}
# prisma generate lit prisma.config.ts, qui exige DATABASE_URL ; aucune connexion n'est faite à cette étape,
# une URL factice suffit. La vraie arrive au démarrage, par docker-compose.
RUN if [ -f prisma/schema.prisma ]; then DATABASE_URL=postgresql://construction@localhost/aucune pnpm exec prisma generate; fi && pnpm exec tsc

# Au démarrage : appliquer les migrations existantes (migrate DEPLOY : jamais de génération
# ni de réinitialisation), puis lancer le serveur. Les variables viennent de docker-compose.
CMD ["sh", "-c", "if [ -f prisma/schema.prisma ]; then pnpm exec prisma migrate deploy; fi && node dist/server.js"]
