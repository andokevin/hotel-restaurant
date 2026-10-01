# Front : construit par Vite, servi par nginx, qui relaie /api vers la gateway.
FROM node:24-alpine AS construction
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@hotel/web..." && pnpm --filter @hotel/web build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construction /app/apps/web/dist /usr/share/nginx/html
