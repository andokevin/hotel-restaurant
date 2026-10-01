# Hôtel & Restaurant — architecture orientée services

Projet de cours : le processus BPMN d'un hôtel-restaurant à Madagascar (réservation, paiement
Papi.mg, séjour, ménage, stock, restaurant, comptabilité), découpé en services indépendants.

- **Guide complet** (architecture, choix techniques, journal de chaque phase, questions d'entretien) : [docs/GUIDE.md](docs/GUIDE.md)
- **Front** : [apps/web/README.md](apps/web/README.md)

## Lancer l'application en 5 commandes

Prérequis : Docker, Node 24 (pour les scripts), `curl`, `openssl`.

```bash
bash scripts/generer-env-docker.sh                       # 1. secrets (.env racine, jamais commité)
docker compose --profile app up -d --build               # 2. PostgreSQL, Redis, 8 services, front, faux Papi
docker compose exec -e ADMIN_TELEPHONE=0340000001 -e ADMIN_EMAIL=direction@hotel-tana.mg \
  -e ADMIN_MOT_DE_PASSE='choisis-un-mot-de-passe' auth node dist/scripts/creer-admin.js   # 3. premier ADMIN
ADMIN_MOT_DE_PASSE='choisis-un-mot-de-passe' SEED_MOT_DE_PASSE='Demo-Tana-2026' bash scripts/seed.sh   # 4. données de démo
xdg-open http://localhost:8080                            # 5. l'application
```

Comptes de démonstration créés par le seed (mot de passe : `SEED_MOT_DE_PASSE`) :

| Rôle | Identifiant (téléphone) | Email |
|---|---|---|
| ADMIN | 0340000001 | direction@hotel-tana.mg |
| RECEPTIONNISTE | 0341000001 | reception@hotel-tana.mg |
| FEMME_MENAGE | 0341000002 / 0341000003 | hanta.menage@… / voahangy.menage@… |
| RESTAURANT | 0341000004 | restaurant@hotel-tana.mg |
| COMPTABLE | 0341000005 | comptabilite@hotel-tana.mg |
| COMMUNICATION | 0341000006 | communication@hotel-tana.mg |
| CLIENT | 0331234567 | jean.rakoto@mail.mg |

Démo depuis un autre appareil du réseau local : ouvrir `http://<IP-de-la-machine>:8080`
(le cookie de session n'exige pas HTTPS par défaut, `COOKIE_SECURISE=false` ; le mettre à `true` derrière HTTPS).

Le paiement passe par un **faux Papi** (http://localhost:4010) : la page propose « Payer » ou « Refuser »
et envoie la notification comme le vrai. Pour le vrai Papi en mode test, voir « Paiement réel » plus bas.

## Architecture

| Composant | Port | Rôle |
|---|---|---|
| web (nginx) | 8080 | Front React ; relaie `/api` vers la gateway |
| api-gateway | 3000 | Seul point d'entrée : JWT, rôles, refus par défaut |
| auth | 3003 | Comptes, connexion (téléphone ou email), sessions |
| hebergement | 3001 | Catégories, chambres, réservations, séjours |
| facturation | 3002 | Factures, paiements Papi, encaissements |
| menage | 3004 | Tâches de ménage |
| stock | 3005 | Articles d'accueil, mouvements |
| restaurant | 3006 | Menus, commandes |
| comptabilite | 3007 | Tableaux de bord, reversements |
| PostgreSQL / Redis | 5432 / 6381 | Une base par service ; BullMQ |

Les services ne publient aucun port dans Docker : seule la gateway (et le front) sont joignables.
Chaque service exige la clé interne `CLE_INTERNE`, que seule la gateway (et les autres services) connaissent.

## Développement (sans Docker pour les services)

```bash
docker compose up -d                       # PostgreSQL + Redis seulement
pnpm install && pnpm build:commun          # build:commun après chaque modification de packages/commun
# .env de chaque service : voir services/*/.env.example (même CLE_INTERNE partout,
# clés JWT : pnpm --filter @hotel/auth generer-cles)
pnpm -r --filter "./services/*" --filter "!@hotel/api-gateway" exec prisma migrate deploy
pnpm test                                  # tests de tous les services (bases *_test_db, Redis préfixe hotel-test)
pnpm dev                                   # tous les services + workers
pnpm --filter @hotel/web dev               # front sur http://localhost:5173 (proxy /api → :3000)
```

Scénarios de bout en bout (terminal, via la gateway) : `scripts/scenario-phase2.sh` à `scenario-phase4.sh`.

## Paiement réel (Papi.mg, mode test)

```bash
cloudflared tunnel --url http://localhost:3000     # → https://xxx.trycloudflare.com
# dans .env (racine) : PAPI_BASE_URL=https://app.papi.mg, PAPI_API_KEY=…, PUBLIC_URL=https://xxx.trycloudflare.com
docker compose --profile app up -d facturation
```

## Règles critiques couvertes par des tests

Surbooking (contrainte EXCLUDE, choix de chambre concurrent), paiement (montant serveur, jeton haché,
`notificationToken`, montant contrôlé, surpaiement refusé par la base), idempotence (Idempotency-Key,
événements rejoués, notifications en double), consommation du stock (décrément atomique, jamais négatif,
franchissement du seuil), expiration à 30 minutes, rôles et refus par défaut de la gateway.
