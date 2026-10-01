# Étude du code — fonctionnalité par fonctionnalité

> Document d'étude. Pour chaque fonctionnalité : **qui** l'utilise et par quelle **route**, les **fichiers et fonctions**,
> les **variables / constantes clés**, la **logique pas à pas**, les **techniques** employées et **où c'est testé**.
> Les chemins sont relatifs à la racine du dépôt. Les « pourquoi » détaillés sont dans [GUIDE.md](GUIDE.md).

Sommaire

0. [Comment lire le code : le trajet d'une requête](#0-comment-lire-le-code--le-trajet-dune-requête)
1. [Le socle partagé : `packages/commun`](#1-le-socle-partagé--packagescommun)
2. [api-gateway : le point d'entrée unique](#2-api-gateway--le-point-dentrée-unique)
3. [auth : comptes et connexion](#3-auth--comptes-et-connexion)
4. [hebergement : chambres, réservations, séjours](#4-hebergement--chambres-réservations-séjours)
5. [facturation : factures et paiement Papi](#5-facturation--factures-et-paiement-papi)
6. [menage : tâches de ménage](#6-menage--tâches-de-ménage)
7. [stock : articles d'accueil](#7-stock--articles-daccueil)
8. [restaurant : menus et commandes](#8-restaurant--menus-et-commandes)
9. [comptabilite : copies, reversements, tableau de bord](#9-comptabilite--copies-reversements-tableau-de-bord)
10. [Le front React (`apps/web`)](#10-le-front-react-appsweb)
11. [Infrastructure, scripts et tests](#11-infrastructure-scripts-et-tests)
12. [Catalogue des événements : qui émet, qui consomme](#12-catalogue-des-événements--qui-émet-qui-consomme)
13. [Index des techniques](#13-index-des-techniques)

---

## 0. Comment lire le code : le trajet d'une requête

Tous les services suivent **la même structure** : une fois que tu en as compris un, tu les as tous compris.

```
services/<service>/
├── prisma/schema.prisma          les tables du service (UNE base par service)
├── prisma/migrations/*/          le SQL appliqué, dont les contraintes écrites à la main (EXCLUDE, CHECK…)
├── src/config/env.ts             variables d'environnement validées par Zod (le service refuse de démarrer sinon)
├── src/db.ts                     l'instance unique de PrismaClient (adapter-pg)
├── src/logger.ts                 le logger Pino du service
├── src/bus.ts                    l'instance BusEvenements (BullMQ) du service
├── src/outbox.ts                 écrire un événement dans la transaction + consommer une seule fois
├── src/modules/<module>/
│   ├── <module>.schema.ts        ① validation Zod de ce qui ENTRE (corps, paramètres)
│   ├── <module>.service.ts       ② la logique métier (transactions, règles)
│   ├── <module>.controller.ts    ③ lit la requête, appelle le service, renvoie la réponse
│   └── <module>.routes.ts        ④ associe une URL à un contrôleur
├── src/app.ts                    assemble Express : sécurité, journal, clé interne, routes, gestionnaire d'erreurs
├── src/jobs.ts                   workers BullMQ : relais outbox, consommateurs d'événements, tâches planifiées
├── src/server.ts                 démarre HTTP + jobs, arrêt propre (SIGTERM)
└── tests/                        Vitest + Supertest sur une vraie base *_test_db
```

**Trajet d'une requête « réserver une chambre »** :

```
Navigateur ──► nginx (8080) ou Vite (5173) ──► api-gateway (3000)
   1. retire les en-têtes x-utilisateur-* et x-cle-interne envoyés par le client
   2. trouve la règle de REGLES (POST /reservations) → vérifie le JWT → vérifie le rôle
   3. ajoute x-utilisateur-id / x-utilisateur-role / x-cle-interne, transmet à hebergement
──► hebergement (3001)
   4. exigerCleInterne  →  routeurReservations  →  controller.creer
   5. creerReservationSchema.parse(body)  →  service.creerReservation(...)
   6. transaction PostgreSQL : réservation + nuitées + ligne outbox « reservation.creee »
   7. après le commit : job d'expiration différé (30 min) dans Redis
──► (2 s plus tard) relais outbox → file Redis evt.facturation.reservation.creee
──► facturation : traiterReservationCreee → facture SEJOUR émise
```

---

## 1. Le socle partagé : `packages/commun`

Code **transversal**, sans aucune logique métier, utilisé par tous les services (`import … from "@hotel/commun"`).
Il est compilé dans `packages/commun/dist` : `pnpm build:commun` après chaque modification.

### 1.1 Erreurs prévues — `src/erreurs.ts`

| Élément | Rôle |
|---|---|
| `class AppError(statusCode, code, message)` | Erreur « attendue » dont on connaît le code HTTP |
| `NonAutorise(msg?)` | 401 `NON_AUTORISE` |
| `Interdit(msg?)` | 403 `INTERDIT` |
| `NotFound(quoi)` | 404 `NOT_FOUND` — « Réservation introuvable » |
| `Conflit(msg)` | 409 `CONFLICT` |
| `RegleMetier(msg)` | 422 `REGLE_METIER` |

**Logique** : le code métier fait `throw NotFound("Chambre")` ; Express 5 transmet l'erreur au gestionnaire (1.3), qui répond `404 { code, message }`.
**Technique** : fabriques d'erreurs (fonctions qui créent l'objet), sous-classe de `Error`.

### 1.2 Lire une erreur Prisma — `src/erreurs-base.ts`

| Élément | Rôle |
|---|---|
| `type ErreurBase = { prismaCode, pgCode?, contrainte? }` | Ce qu'on retient d'une erreur de base |
| `lireErreurBase(err)` | Reconnaît une `PrismaClientKnownRequestError` **par sa forme** et extrait le code Prisma (`P2002`…), le code PostgreSQL (`23P01`…) et **le nom de la contrainte** |

**Logique** :
1. si `err.name !== "PrismaClientKnownRequestError"` → `null` ;
2. va chercher `meta.driverAdapterError.cause` (format de l'adapter-pg) ;
3. le nom de la contrainte est soit dans `cause.constraint.index` (unicité, clé étrangère), soit **seulement dans le message** (`EXCLUDE`, `CHECK`) → expression régulière `/constraint "([^"]+)"/`.

**Techniques** : *duck typing* (on teste la forme, pas la classe, car chaque service a son propre client Prisma généré), garde de type `estObjet(v): v is Record<string, unknown>`.
**Pourquoi c'est central** : toutes les règles protégées par la base (surbooking, surpaiement, stock négatif, idempotence) sont reconnues grâce au nom de leur contrainte.

### 1.3 Gestionnaire d'erreurs — `src/gestionnaire-erreurs.ts`

| Élément | Rôle |
|---|---|
| `creerGestionnaireErreurs({ logger, contraintes })` | Fabrique le middleware d'erreur Express du service |
| `contraintes` (paramètre) | Table **propre au service** : nom de contrainte → `{ status, code, message }` |
| `reponseParDefaut(e)` | P2002 → 409 DOUBLON, P2003 → 409, P2025 → 404, P2007 → 400, PG 23514 (CHECK) → 422 |

**Logique (ordre)** : `ZodError` → 400 avec `details[{ champ, message }]` ; `AppError` → son code ; erreur de base → contrainte déclarée par le service, sinon réponse par défaut ; tout le reste → journalisé, **500 sans détail** au client.
**Technique** : injection de configuration (le paquet commun ne connaît aucune règle métier : c'est hebergement qui déclare `reservation_sans_chevauchement → 409 CHAMBRE_INDISPONIBLE`).

### 1.4 Journalisation — `src/logger.ts`

`creerLogger(service)` → logger **Pino** JSON avec `service` sur chaque ligne (silencieux en test). `journalRequetes(logger)` → middleware **pino-http** : une ligne par requête avec un identifiant `req.id`.

### 1.5 Clé interne et empreintes — `src/cle-interne.ts`

| Élément | Rôle |
|---|---|
| `EN_TETE_CLE_INTERNE = "x-cle-interne"` | Nom de l'en-tête |
| `clesEgales(recue, attendue)` | Compare deux secrets **en temps constant** (via leurs SHA-256, de même longueur) |
| `exigerCleInterne(cle)` | Middleware : 401 si l'en-tête manque ou est faux |
| `empreinteSha256(secret)` | Empreinte hexadécimale à **stocker** (jamais le secret) |
| `correspondAEmpreinte(recu, empreinte)` | Le secret reçu correspond-il à l'empreinte stockée ? (temps constant) |

**Techniques** : `crypto.timingSafeEqual` (empêche de deviner un secret caractère par caractère en chronométrant), hachage SHA-256.
**Utilisé par** : tous les services (`app.use(exigerCleInterne(env.CLE_INTERNE))`), le jeton de notification Papi, le `notificationToken`.

### 1.6 Identité et rôles — `src/identite.ts`, `src/roles.ts`

| Élément | Rôle |
|---|---|
| `ROLES` (7 rôles), `type Role` | Les lanes du BPMN + ADMIN + CLIENT |
| `EN_TETE_UTILISATEUR_ID`, `EN_TETE_UTILISATEUR_ROLE` | En-têtes posés **par la gateway** après vérification du JWT |
| `lireIdentite(req)` | Lit ces en-têtes, les valide avec Zod → `{ id, role }` ou `null` |
| `JWT_EMETTEUR`, `JWT_AUDIENCE`, `JWT_ALGORITHME` | Contrat du JWT partagé par auth (signe) et la gateway (vérifie) |
| `exigerRoles(...roles)` (`roles.ts`) | Middleware de **défense en profondeur** (utilisé par auth pour la gestion des comptes) |

### 1.7 Validation de `:id` — `src/validation.ts`

`lireId(req)` = `z.object({ id: z.uuid() }).parse(req.params).id` → un `:id` invalide donne **400** au lieu d'une erreur PostgreSQL (500).

### 1.8 Dates de Madagascar — `src/temps.ts`

| Fonction | Rôle |
|---|---|
| `aujourdhuiMadagascar(maintenant?)` | `"2026-10-01"` dans le fuseau `Indian/Antananarivo` (`Intl.DateTimeFormat("en-CA")` donne AAAA-MM-JJ) |
| `anneeMadagascar()` | Année locale (numérotation RES-/FAC-/CMD-) |
| `enTexte(date)` | Une colonne `DATE` lue par Prisma (minuit UTC) → `"AAAA-MM-JJ"` |

**Pourquoi** : le serveur peut tourner en UTC ; « aujourd'hui » doit être celui de l'hôtel.

### 1.9 Événements — `src/evenements.ts`

| Élément | Rôle |
|---|---|
| `CONTRATS` | Pour chaque type d'événement, le **schéma Zod** de son contenu (le contrat entre émetteur et consommateurs) |
| `type TypeEvenement`, `ContenuEvenement<T>`, `Enveloppe<T>` | Types déduits : `{ id, type, emisLe, payload }` |
| `estEnveloppe(type, donnees)` | **Prédicat de type** : valide l'enveloppe et son contenu ; TypeScript en déduit le type, sans cast |
| `ABONNEMENTS` | Qui écoute quoi (ex. `"sejour.termine": ["menage", "facturation"]`) |
| `nomFile(consommateur, type)` | `evt.<consommateur>.<type>` (BullMQ interdit « : ») |

### 1.10 Bus BullMQ — `src/bus.ts`

| Élément | Rôle |
|---|---|
| `creerClientRedis(url)` | Client **ioredis** construit nous-mêmes (`maxRetriesPerRequest: null`) — BullMQ 6 en ESM l'exige |
| `class BusEvenements` | Une instance par service |
| `.file(nom)` | Renvoie (et met en cache) la `Queue` BullMQ de ce nom |
| `.publier(evt)` | Dépose l'événement dans la file de **chaque abonné**, avec `jobId = id de l'événement` (doublon ignoré), 8 essais, délai exponentiel |
| `.consommer(consommateur, type, traiter)` | Crée le `Worker` d'un consommateur ; valide avec `estEnveloppe` ; message invalide → `UnrecoverableError` (pas de réessai) |
| `.traiter(nom, processeur)` | Worker d'une file interne (expirations, tâches planifiées) |
| `.fermer()` | Ferme les files puis le client Redis (BullMQ ne ferme jamais un client prêté) |

**Technique** : *fan-out* manuel (une file par abonné), car BullMQ est une file de tâches, pas un système pub/sub.

### 1.11 Relais d'outbox — `src/outbox.ts`

| Élément | Rôle |
|---|---|
| `type DepotOutbox = { lireEnAttente, marquerPublies }` | Ce que le service fournit (accès à SA table) |
| `relayerOutbox(bus, depot, logger, lot)` | Lit les événements non publiés, les publie, puis les marque publiés ; s'arrête proprement si Redis tombe |
| `estDoublonEvenement(err)` | L'insertion dans `evenement_traite` a violé sa clé primaire → événement déjà traité |

---

## 2. api-gateway : le point d'entrée unique

Port **3000**, aucune base. Fichiers : `services/api-gateway/src/`.

### 2.1 Table des droits — `src/regles.ts`

| Élément | Rôle |
|---|---|
| `type NomService` | Les 7 services cibles |
| `type Acces = "PUBLIC" \| "CONNECTE" \| Role[]` | Qui a le droit |
| `REGLES: Regle[]` | **Toute** la politique d'accès : `{ methode, chemin, service, acces }` |
| `RECEPTION`, `PERSONNEL_CAISSE` | Listes de rôles réutilisées |

**Règle d'or** : *refus par défaut*. Une route absente de `REGLES` → **404**, même si le service la connaît (c'est ce qui rend `/interne/...` injoignable). **L'ordre compte** : les chemins fixes (`/reservations/departs`) avant `/reservations/:id`.

### 2.2 Vérification du JWT — `src/authentification.ts`

`authentifier(enTeteAuthorization)` :
1. pas d'en-tête → `null` (visiteur anonyme) ;
2. `Bearer <jeton>` sinon 401 ;
3. `jwtVerify(jeton, clePublique, { issuer, audience, algorithms: ["EdDSA"] })` (bibliothèque **jose**) : signature, expiration, émetteur, audience, **algorithme imposé** ;
4. contenu validé par Zod (`sub` uuid, `role` dans `ROLES`) → `{ id, role }`.

Variable : `clePublique` = `importSPKI(env.JWT_CLE_PUBLIQUE décodé)` — la gateway peut **vérifier**, jamais **signer**.

### 2.3 Le pipeline — `src/app.ts`

| Étape (dans l'ordre des `app.use`) | Rôle |
|---|---|
| `helmet()`, `cors({ origin: FRONT_URL, credentials: true })` | En-têtes de sécurité ; seul le front peut appeler l'API depuis un navigateur |
| `journalRequetes(logger)` | Journal des requêtes |
| *(pas de `express.json()`)* | Le proxy retransmet le flux brut ; le lire ici viderait le corps |
| Nettoyage | `delete req.headers["x-utilisateur-id" / "x-utilisateur-role" / "x-cle-interne"]` |
| `limiteConnexion` (express-rate-limit) | `POST /api/auth/connexion` : `LIMITE_CONNEXIONS` **échecs** par IP / 15 min (`skipSuccessfulRequests`) → 429 |
| `garde(acces, service)` | Authentifie, vérifie le rôle, pose les en-têtes d'identité, mémorise le service dans `serviceCible` (WeakMap), puis `next("router")` |
| Routeur `autorisation` | Construit en bouclant sur `REGLES` : `autorisation[methode](chemin, garde(...))` |
| `proxyVers(cible)` | `createProxyMiddleware` (http-proxy-middleware) : ajoute `x-cle-interne` ; service injoignable → 502 |
| Dernier `app.use("/api", …)` | Aucune règle trouvée → 404 `ROUTE_INCONNUE` |

**Techniques** : reverse proxy, RBAC (contrôle par rôle), refus par défaut, `WeakMap` (donnée liée à une requête sans fuite mémoire), `next("router")`, limitation de débit.
**Testé dans** : `services/api-gateway/tests/gateway.test.ts` (faux services « écho », jetons signés par le test).

---

## 3. auth : comptes et connexion

Port **3003**, base `auth_db` (tables `utilisateur`, `session`). Fichiers : `services/auth/src/`.

### 3.1 Inscription d'un client

- **Route** : `POST /api/auth/inscription` (public).
- **Fichiers** : `modules/utilisateur/utilisateur.schema.ts` (`inscriptionSchema`, `telephone`, `email`, `normaliserTelephone`), `modules/session/session.controller.ts` (`inscription`), `modules/utilisateur/utilisateur.service.ts` (`inscrire`, `creer`), `mot-de-passe.ts` (`hacherMotDePasse`).
- **Logique** :
  1. Zod : `nom`, `telephone` **normalisé** (`+261 34…` → `034…`, regex `^0(32|33|34|37|38)\d{7}$`), `email` en minuscules, `motDePasse` 10 à 128 caractères ;
  2. le **rôle n'est pas dans le schéma** → forcé à `CLIENT` dans `inscrire` (un `"role": "ADMIN"` envoyé est ignoré) ;
  3. mot de passe haché (3.2), création ; doublon → contraintes `utilisateur_telephone_key` / `utilisateur_email_key` → 409.
- **Variables** : `CHAMPS_PUBLICS` (les colonnes renvoyées : jamais `motDePasseHash`).
- **Techniques** : `z.string().transform(normaliser).pipe(regex)`, contrainte d'unicité traduite par le gestionnaire.

### 3.2 Hachage des mots de passe — `mot-de-passe.ts`

| Élément | Rôle |
|---|---|
| `hacherMotDePasse(mdp)` | `scrypt` (node:crypto) avec un **sel aléatoire** de 16 octets → `scrypt$N$r$p$sel$empreinte` |
| `verifierMotDePasse(mdp, stocke)` | Relit les paramètres stockés, recalcule, compare avec `timingSafeEqual` |
| `obtenirHashFactice()` | Hash calculé une fois, utilisé quand le compte n'existe pas → **même durée** de réponse |
| `R=8`, `P=1`, `LONGUEUR=64`, `MEMOIRE_MAX=256 Mo`, `env.SCRYPT_N` (2^17, 2^10 en test) | Paramètres OWASP |

### 3.3 Connexion

- **Route** : `POST /api/auth/connexion` `{ identifiant, motDePasse }`.
- **Fichiers** : `modules/session/session.schema.ts` (`connexionSchema`), `session.service.ts` (`connecter`, `ouvrirSession`), `jetons.ts`, `session.controller.ts` (`connexion`, `optionsCookie`).
- **Logique** :
  1. `identifiant` = email (s'il contient « @ ») **ou** téléphone : `z.union([email.transform(v => ({ email: v })), telephone.transform(v => ({ telephone: v }))])` → `findUnique({ where: identifiant })` ;
  2. compte inconnu → vérification contre le hash factice puis **même** erreur 401 `IDENTIFIANTS_INVALIDES` ;
  3. mauvais mot de passe → même 401 ; compte désactivé → 403 (seulement après un bon mot de passe) ;
  4. `ouvrirSession` : crée une ligne `session` avec `jetonHash = SHA-256(jeton aléatoire)`, signe le JWT ;
  5. réponse `{ jetonAcces, expireDans, utilisateur }` + cookie `hotel_session` (httpOnly, SameSite=Strict, Path=/api/auth, Secure selon `COOKIE_SECURISE`).
- **Variables** : `DUREE_ACCES_SECONDES = 900` (15 min), `DUREE_SESSION_MS` (7 jours), `NOM_COOKIE = "hotel_session"`.
- **Fichier `jetons.ts`** : `signerJetonAcces` (jose `SignJWT`, EdDSA, `sub`, `role`, `iss`, `aud`, `exp`), `nouveauJetonSession` (32 octets aléatoires), `hacherJeton` (SHA-256).
- **Techniques** : JWT asymétrique Ed25519, cookie httpOnly, anti-énumération (même message, même durée).

### 3.4 Rafraîchissement et détection de vol

- **Route** : `POST /api/auth/rafraichir` (cookie). **Fonction** : `session.service.ts` → `rafraichir(jetonSession)`.
- **Logique (rotation)** :
  1. retrouve la session par `SHA-256(cookie)` ;
  2. session **déjà révoquée** → c'est un rejeu : **toutes** les sessions du compte sont révoquées, 401 ;
  3. expirée ou compte inactif → 401 ;
  4. `updateMany({ where: { id, revoqueLe: null } })` → si `count === 0`, une autre requête l'a utilisée au même instant → 401 ;
  5. nouvelle session + nouveau JWT + nouveau cookie.
- **Techniques** : rotation des jetons de rafraîchissement, écriture conditionnelle.

### 3.5 Déconnexion, profil, gestion des comptes

| Route | Fonction | Logique |
|---|---|---|
| `POST /api/auth/deconnexion` | `deconnecter` | révoque la session du cookie, efface le cookie, 204 |
| `GET /api/auth/moi` | `moi` | lit l'identité posée par la gateway (`lireIdentite`) |
| `GET/POST /api/auth/utilisateurs` | `listerUtilisateurs`, `creerUtilisateur` | ADMIN (gateway **et** `exigerRoles("ADMIN")` dans `routes.ts`) |
| `PATCH /api/auth/utilisateurs/:id` | `mettreAJourUtilisateur` | change `actif` / `role` ; **révoque ses sessions** dans la même transaction |
| `GET /interne/utilisateurs/:id` | `app.ts` | nom d'un employé pour un snapshot (appelé par menage) |

### 3.6 Scripts

`src/scripts/generer-cles.ts` (paire Ed25519 en base64 : privée pour auth, publique pour la gateway) · `src/scripts/creer-admin.ts` (premier ADMIN, à partir de `ADMIN_TELEPHONE`, `ADMIN_EMAIL`, `ADMIN_MOT_DE_PASSE`).

**Testé dans** : `services/auth/tests/auth.test.ts` (16 tests).

---

## 4. hebergement : chambres, réservations, séjours

Port **3001**, base `hebergement_db`. Fichiers : `services/hebergement/src/`.

### 4.1 Catégories et chambres

| Route | Fichier → fonction | Logique |
|---|---|---|
| `GET /categories` (public) | `categorie.service.ts` → `listerCategories` | triées par tarif |
| `POST /categories` (ADMIN) | `creerCategorie` | `creerCategorieSchema` : code STANDARD/SUITE_SENIOR/SUITE_PRESTIGE, libellé `{fr, mg?, en?}`, capacité, tarif |
| `GET /chambres?etatMenage=` | `chambre.service.ts` → `listerChambres` | filtre facultatif, inclut la catégorie |
| `POST /chambres` (ADMIN) | `creerChambre` | vérifie la catégorie (404), numéro unique (409) |

Tables : `categorie_chambre`, `chambre` (`etatMenage` PROPRE/SALE/EN_NETTOYAGE, `horsService`, `version`).

### 4.2 Réserver une catégorie (le serveur choisit la chambre)

- **Route** : `POST /api/reservations` (CLIENT, réception) + en-tête facultatif `Idempotency-Key`.
- **Fichiers** : `reservation.schema.ts` (`creerReservationSchema`, `cleIdempotenceSchema`), `reservation.controller.ts` (`creer`, `identiteRequise`), `reservation.service.ts` (`creerReservation`, `calculerNuitees`, `prochaineReference`, `relireIdempotence`), `tarif.ts` (`listerNuits`), `expiration.ts` (`planifierExpiration`).
- **Variables** : `ACTIFS` (statuts qui occupent une chambre), `ROUTE_CREATION`, `DETAIL` (ce qu'on inclut dans la réponse), `DELAI_PAIEMENT_MS` (30 min).
- **Logique** :
  1. Zod : dates `AAAA-MM-JJ`, départ > arrivée, arrivée ≥ aujourd'hui **à Madagascar**, téléphone malgache, email obligatoire ;
  2. `Idempotency-Key` déjà vue → `relireIdempotence` renvoie la réservation créée la première fois (vérifie que la clé appartient au même utilisateur, sinon 422) ;
  3. `calculerNuitees` : `listerNuits` (une date par nuit) + tarif de la saison si elle existe, sinon tarif de base → **montant calculé par le serveur** ;
  4. **candidates** : chambres de la catégorie, en service, sans réservation active qui chevauche (lecture *indicative*) ;
  5. pour **chaque** candidate, une **transaction séparée** : référence (`prochaineReference`), réservation, nuitées, événement `reservation.creee` (outbox), ligne `cle_idempotence` ;
  6. si PostgreSQL refuse (`reservation_sans_chevauchement`) → chambre suivante ; plus aucune → 409 `AUCUNE_CHAMBRE_DISPONIBLE` ;
  7. après le commit : `planifierExpiration` (job différé).
- **Techniques** : contrainte `EXCLUDE USING gist` + `btree_gist` (anti-surbooking garanti par la base), verrouillage **optimiste** (on tente, on recommence), outbox, clé d'idempotence, compteur atomique (`upsert` + `increment` = `INSERT … ON CONFLICT DO UPDATE`).
- **Testé dans** : `tests/surbooking.test.ts`, `tests/phase3.test.ts` (« 3 demandes pour 2 chambres », Idempotency-Key).

### 4.3 Expiration à 30 minutes — `modules/reservation/expiration.ts`

| Fonction | Rôle |
|---|---|
| `planifierExpiration(id, expireLe)` | `file.add("expirer", …, { jobId: "expiration-<id>", delay })` |
| `annulerExpiration(id)` | `file.remove("expiration-<id>")` (au paiement ou à l'annulation) — une **optimisation** |
| `expirerReservation(id)` | le job : `updateMany({ where: { id, statut: "EN_ATTENTE_PAIEMENT", expireLe: { lte: now } } })` — la **vraie garantie** |
| `balayerExpirations()` | filet de sécurité chaque minute pour les jobs perdus |

**Technique** : job **différé** BullMQ, `jobId` prévisible, écriture conditionnelle (pas de « lire puis écrire »).

### 4.4 Confirmation après paiement

- **Déclencheur** : événement `paiement.recu` (de facturation). **Fonctions** : `traiterPaiementRecu(evt)`, `confirmerDansTransaction(tx, id)`.
- **Logique** : `traiterUneFois(evt.id, …)` (idempotence) → réservation déjà CONFIRMEE / EN_COURS / TERMINEE (paiement d'un solde) → rien ; EN_ATTENTE → `verifierTransition` → `updateMany` conditionnel (version + statut) → événement `reservation.confirmee` → après le commit, `annulerExpiration`. Réservation ANNULEE → journalisé « remboursement à prévoir », sans réessai.

### 4.5 Machine à états — `modules/reservation/transitions.ts`

`TRANSITIONS` : `EN_ATTENTE_PAIEMENT → CONFIRMEE | ANNULEE`, `CONFIRMEE → EN_COURS | ANNULEE`, `EN_COURS → TERMINEE`. `verifierTransition(de, vers)` lève 422 sinon.

### 4.6 Check-in, check-out, annulation

| Route (réception) | Fonction | Logique clé |
|---|---|---|
| `POST /reservations/:id/check-in` `{ pieceIdentiteVerifiee: true, chambreId? }` | `faireCheckIn` | jour d'arrivée atteint ; chambre de la **même catégorie** ; `updateMany({ where: { id: chambreId, etatMenage: "PROPRE", horsService: false } })` **vérifie et verrouille** la chambre ; réattribution possible (EXCLUDE refuse une chambre occupée → 409) ; événement `sejour.commence` |
| `POST /reservations/:id/check-out` | `faireCheckOut` | `EN_COURS → TERMINEE` ; chambre `SALE` ; événement `sejour.termine` avec `nbNuits` |
| `POST /reservations/:id/annuler` | `annulerReservation` | depuis EN_ATTENTE ou CONFIRMEE ; supprime le job d'expiration |

Schéma : `checkInSchema` (`z.literal(true)` pour la pièce d'identité = tâche BPMN « Vérifier la pièce d'identité »).

### 4.7 Lectures et routes internes

| Route | Fonction | Particularité |
|---|---|---|
| `GET /reservations` (réception) | `listerReservations` | filtre `statut` validé par Zod |
| `GET /reservations/mes-reservations` (CLIENT) | `listerMesReservations` | par `clientId` |
| `GET /reservations/:id` | `trouverReservationPour` | un CLIENT ne voit que les siennes (sinon **404**, pas 403) |
| `GET /reservations/departs` | `listerDeparts` | minuteur BPMN « Date de départ atteinte » |
| `GET /interne/reservations/:id` | `trouverReservation` | lu par facturation |
| `GET /interne/reservations/en-cours?chambre=` | `reservationEnCours` | lu par restaurant (imputation) |
| `GET /interne/reservations/statistiques?jour=` | `statistiquesDuJour` | nuitées vendues + canaux (comptabilité) |
| `POST /interne/reservations/:id/confirmer` | `confirmerReservation` | historique (avant l'événement) |

### 4.8 Chambre propre après ménage — `modules/chambre/menage.ts`

`traiterMenageTermine(evt)` : `traiterUneFois` → `updateMany({ where: { id: chambreId }, data: { etatMenage: "PROPRE" } })`.

### 4.9 Outbox et jobs du service

- `src/outbox.ts` : `ecrireEvenement(tx, type, payload)` (une ligne dans la transaction de l'appelant), `relayerOutbox()`, `traiterUneFois(evenementId, effet)` (insertion dans `evenement_traite` + effet, dans la même transaction).
- `src/jobs.ts` → `demarrerJobs()` : planifie `relais-outbox` (2 s), `balayage-expirations` (1 min), `purge-idempotence` (3 h, heure de Madagascar) avec `upsertJobScheduler` ; workers des expirations, de `paiement.recu`, de `menage.termine`.
- `src/server.ts` : démarre HTTP + jobs, **arrêt propre** sur SIGINT/SIGTERM.

**Testé dans** : `tests/phase3.test.ts`, `tests/surbooking.test.ts`, `tests/corrections-phase1.test.ts` (44 tests).

---

## 5. facturation : factures et paiement Papi

Port **3002**, base `facturation_db` (tables `facture`, `ligne_facture`, `paiement`, `compteur_facture`). Fichiers : `services/facturation/src/`.

### 5.1 Émission de la facture d'un séjour

- **Déclencheurs** : événement `reservation.creee` → `traiterReservationCreee` ; **ou** à la volée → `obtenirFactureSejour(reservationId)` (si le client paie avant l'arrivée de l'événement : relit la réservation en REST, `hebergement.ts` → `lireReservation`).
- **Fonctions** : `facture.service.ts` → `emettreDansTransaction`, `ligneSejour` ; `numero.ts` → `prochainNumero` (FAC-AAAA-NNNNNN, **sans trou** car dans la même transaction).
- **Variables** : `type SnapshotSejour` (copie figée : client, catégorie, chambre, dates, nuits, montant).
- **Techniques** : idempotence par `reservation_id` unique (deux chemins concurrents → P2002 → on relit), snapshot.

### 5.2 Demander un lien de paiement

- **Route** : `POST /api/paiements` `{ reservationId }` ou `{ factureId }` (`paiement.schema.ts` → `demandePaiementSchema` en **`.strict()`** : un champ `montant` → 400).
- **Fonction** : `paiement.service.ts` → `demanderPaiement(demande, identite)`.
- **Logique** :
  1. facture (ou émission à la volée) ; un CLIENT doit en être le propriétaire (`clientId`) ;
  2. réservation relue en REST : ANNULEE → facture annulée, 422 ;
  3. **montant = total − déjà payé** (jamais le navigateur), ≥ `MONTANT_MINIMUM` (300 Ar) ;
  4. lien déjà en attente pour ce montant → renvoyé (double clic) ;
  5. jeton secret `randomBytes(32)` → on stocke `empreinteSha256(jeton)` dans `paiement.jetonHash` ;
  6. index unique **partiel** `paiement_un_en_attente_par_facture` : deux demandes simultanées → une seule passe ;
  7. **hors transaction** : `papi.ts` → `creerLienPaiement` (POST `/dashboard/api/payment-links`, en-tête `Token`, `notificationUrl = PUBLIC_URL/api/paiements/notification?paiement=<id>&jeton=<secret>`) ;
  8. on stocke l'URL et `SHA-256(notificationToken)` ; échec Papi → paiement ECHOUE, 502.

### 5.3 Recevoir la notification de Papi

- **Route** : `POST /api/paiements/notification?paiement=&jeton=` (**publique** dans la gateway).
- **Fonction** : `recevoirNotification(query, corps)`.
- **Logique** : jeton comparé à l'empreinte (temps constant) → sinon 401 ; corps lu par `notificationSchema` (**permissif**, `.loose()`) ; job BullMQ `jobId = papi-<paymentReference>` (même notification = même job) ; **200 immédiat**.

### 5.4 Traiter la notification (worker)

- **Fonction** : `traiterNotification(donnees)` ; file `FILE_NOTIFICATIONS`.
- **Logique** :
  1. `notificationToken` comparé à son empreinte → sinon `UnrecoverableError` ;
  2. `merchantPaymentReference` doit être notre id ;
  3. `lireStatut` : SUCCESS → succès, FAILED/CANCELLED/EXPIRED → échec, PENDING → rien ;
  4. échec → `updateMany(EN_ATTENTE → ECHOUE)` avec le message de Papi ;
  5. succès : montant **exactement** égal et devise MGA, sinon `marquerAnomalie` ;
  6. transaction : `updateMany({ where: { id, statut: "EN_ATTENTE" } })` → `count === 0` = déjà encaissé ; `appliquerPaiement` ;
  7. la base refuse le surpaiement (`facture_pas_de_surpaiement`) → `ANOMALIE`.
- **Fonctions annexes** : `lireMethode` (MVOLA, AIRTEL_MONEY, ORANGE_MONEY, BRED/VISA → CARTE).

### 5.5 Appliquer un paiement, encaisser en espèces, clôturer

| Fonction | Rôle |
|---|---|
| `appliquerPaiement(tx, factureId, paiementId, montant)` | `montantPaye: { increment }` (CHECK `montant_paye <= montant_total`) ; soldée → PAYEE ; facture RESTAURANT → **clôturée aussitôt** ; événement `paiement.recu` |
| `encaisserEspeces(factureId, montant, identite)` — `POST /factures/:id/encaissements` | paiement REUSSI méthode ESPECES, `encaissePar` |
| `cloturerFacture` / `cloturerDansTransaction` — `POST /factures/:id/cloturer` | `updateMany(PAYEE → CLOTUREE)` + événement `facture.cloturee` avec **toutes les lignes et leur origine** |
| `traiterSejourTermine(evt)` | séjour soldé → clôture automatique ; sinon on attend l'encaissement |
| `traiterConsommationImputee(evt)` | ligne `origine = RESTAURANT` (montant recalculé), total augmenté, PAYEE → EMISE |
| `creerFactureRestaurant(d)` — `POST /interne/factures/restaurant` | facture RESTAURANT d'une commande (prix fournis par le service restaurant) |

### 5.6 Lectures

`listerFactures`, `listerMesFactures`, `trouverFacturePour` (propriétaire), `trouverPaiementPour` — la variable `CHAMPS_PAIEMENT` garantit que **les empreintes ne sortent jamais**.

### 5.7 Faux Papi — `scripts/faux-papi.ts`

Imite l'API Papi (création du lien, page « Payer / Refuser », notification puis redirection) pour la démo sans clé.

**Testé dans** : `tests/facturation.test.ts` (26 tests, avec un faux Papi et un faux hebergement : `tests/faux-services.ts`). **Validé** avec le vrai Papi en sandbox.

---

## 6. menage : tâches de ménage

Port **3004**, base `menage_db` (table `tache_menage`). Fichiers : `services/menage/src/`.

| Fonctionnalité | Fonction (`modules/tache/tache.service.ts`) | Logique |
|---|---|---|
| Tâches du séjour | `traiterSejourCommence(evt)` | une tâche **QUOTIDIEN** par jour strictement entre arrivée et départ (`jourSuivant`) ; `createMany({ skipDuplicates: true })` + `UNIQUE (reservation_id, type, date_prevue)` |
| Tâche de départ | `traiterSejourTermine(evt)` | tâche **DEPART** le jour du départ réel ; supprime les ménages quotidiens restants (départ anticipé) |
| Liste | `listerTaches({ date, statut })` — `GET /taches` | jour par défaut = aujourd'hui à Madagascar ; DEPART en premier |
| Démarrer | `demarrerTache(id, identite)` — `POST /taches/:id/demarrer` | nom de l'employée par REST (`auth.ts` → `lireNomEmploye`, avant l'écriture) ; `updateMany({ where: { id, statut: "A_FAIRE" } })` → une seule employée obtient la tâche (409 sinon) |
| Terminer | `terminerTache(id, identite, data)` — `POST /taches/:id/terminer` | seulement l'employée assignée (403) ; événement `menage.termine` avec les **articles réellement remplacés** (`terminerSchema` : codes uniques, quantités 0–50) |

**Idée clé** : une tâche = une nuitée, donc « 1 de chaque article par tâche » respecte la règle du sujet, et l'écart éventuel sera visible au contrôle de 23 h.
**Testé dans** : `tests/menage.test.ts`.

---

## 7. stock : articles d'accueil

Port **3005**, base `stock_db` (tables `article`, `mouvement`). Fichiers : `services/stock/src/modules/article/`.

| Fonctionnalité | Fonction (`article.service.ts`) | Logique |
|---|---|---|
| Liste | `listerArticles` — `GET /articles` | ajoute `enAlerte = quantite <= seuilAlerte` |
| Créer | `creerArticle` — `POST /articles` | `creerArticleSchema` (code en MAJUSCULES) |
| Mouvement manuel | `mouvementManuel` — `POST /articles/:id/mouvements` | APPROVISIONNEMENT = ENTREE, PERTE = SORTIE (`mouvementManuelSchema` avec `.refine`) ; trace + quantité dans la même transaction |
| Bouger le stock | `bougerStock(tx, articleId, type, quantite)` | `increment` / `decrement` **atomiques** ; `CHECK stock_jamais_negatif` ; si le seuil est **franchi** (`avant > seuil && apres <= seuil`) → événement `stock.seuil_atteint` |
| Sortie du ménage | `traiterMenageTermine(evt)` | **une transaction par article** ; idempotence par `UNIQUE (reference_id, article_id)` ; rupture → journalisée, les autres articles passent |
| Historique | `historique` — `GET /articles/:id/mouvements` | 200 derniers |
| Pour la comptabilité | `sortiesMenageDuJour(jour)` — `GET /interne/sorties-menage?jour=` | `groupBy` des sorties MENAGE du jour (bornes UTC+3) |

Script : `src/scripts/initialiser-articles.ts` (les 4 articles du sujet).
**Testé dans** : `tests/stock.test.ts` (20 ménages simultanés → exactement 20 sorties, jamais négatif, alerte unique).

---

## 8. restaurant : menus et commandes

Port **3006**, base `restaurant_db` (tables `menu`, `plat`, `commande`, `ligne_commande`, `compteur_commande`). Fichiers : `services/restaurant/src/`.

### 8.1 Menus (lanes Restaurant et Communication) — `modules/menu/menu.service.ts`

| Route | Fonction | Logique |
|---|---|---|
| `GET /menus/publies` (public) | `menusPublies` | menus `actif`, plats `disponible` |
| `GET /menus`, `POST /menus`, `POST /menus/:id/plats`, `PATCH /plats/:id` | `tousLesMenus`, `creerMenu`, `ajouterPlat`, `modifierPlat` | gestion de la carte |
| `POST /menus/:id/publier` · `/depublier` (COMMUNICATION) | `publier(id, actif)` | « Publier les menus sur le site web » |
| `GET /menus/:id/texte-facebook` | `texteFacebook` | texte prêt à copier, par catégorie (`ORDRE`, `TITRES`), prix formatés |

### 8.2 Commandes — `modules/commande/commande.service.ts`

| Route | Fonction | Logique |
|---|---|---|
| `POST /commandes` | `creerCommande(data, identite)` | le navigateur n'envoie que `{ platId, quantite }` ; **prix lus en base** et copiés dans `ligne_commande` (snapshot) ; plat indisponible → 422 ; référence CMD-AAAA-NNNNNN |
| `POST /commandes/:id/statut` | `changerStatut` | `TRANSITIONS` RECUE → EN_PREPARATION → PRETE → REMISE (ANNULEE si non payée) ; verrouillage optimiste par `version` |
| `POST /commandes/:id/imputer` `{ chambreNumero }` | `imputerALaChambre` | **REST synchrone** (`services-externes.ts` → `sejourEnCours`) : 422 s'il n'y a pas de séjour ; puis transaction : `IMPUTEE_CHAMBRE` + événement `consommation.imputee` |
| `POST /commandes/:id/facturer` | `facturer` | REST vers facturation (`creerFactureRestaurant`) ; impossible si déjà imputée (409) |
| — | `traiterPaiementRecu(evt)` | `paiement.recu` avec `commandeId` → commande PAYEE |

**Techniques** : snapshot de prix, synchrone (besoin d'une réponse) puis asynchrone (effet chez un autre service), machine à états.
**Testé dans** : `tests/restaurant.test.ts` (faux hebergement et fausse facturation).

---

## 9. comptabilite : copies, reversements, tableau de bord

Port **3007**, base `comptabilite_db`. Fichiers : `services/comptabilite/src/`.

| Fonctionnalité | Fonction (`comptabilite.service.ts`) | Logique |
|---|---|---|
| Copie de facture + reversement | `traiterFactureCloturee(evt)` | copie (`copie_facture`) ; facture **SEJOUR** avec lignes RESTAURANT → `reversement` A_REVERSER du total de ces lignes |
| Tableau du jour | `genererTableau(jour?)` — job 23 h + `POST /comptabilite/tableaux/generer` | REST (`sources.ts` → `nuiteesVendues`, `sortiesMenage`) **avant** la transaction ; copies du jour (`bornes`) ; `attendue = nuitées de la VEILLE × consommationParNuitee` ; `écart = réelle − attendue` ; `upsert` (recalculable) ; écart ≠ 0 → « à signaler à la direction » |
| Consulter | `listerTableaux(du, au)`, `listerReversements(statut)`, `listerCopies(jour)` | `ecartDetecte` calculé |
| Reverser | `effectuerReversement(id)` | `updateMany(A_REVERSER → REVERSE)` ; deux fois → 422 |

`src/jobs.ts` : `upsertJobScheduler("tableau-de-bord", { pattern: "0 23 * * *", tz: "Indian/Antananarivo" })`.
**Testé dans** : `tests/comptabilite.test.ts`.

---

## 10. Le front React (`apps/web`)

React 19, React Router, TanStack Query, react-hook-form + Zod, Tailwind, Vite. Fichiers : `apps/web/src/`.

### 10.1 Client HTTP — `lib/api.ts`

| Élément | Rôle |
|---|---|
| `jetonAcces` (variable de module) | Le JWT, **en mémoire uniquement** |
| `definirJeton(jeton)` | Le pose ou l'efface |
| `requete<T>(methode, chemin, options)` | Ajoute `Authorization`, `credentials: "include"` ; sur **401** : `rafraichirSession()` puis **rejoue une fois** ; sinon `quandSessionExpiree` |
| `rafraichirSession()` + `rafraichissementEnCours` | **Une seule** promesse de rafraîchissement partagée ; verrou entre onglets `navigator.locks` |
| `SANS_REJEU` | Routes d'auth qui ne déclenchent pas de rafraîchissement (évite les boucles) |
| `class ApiError`, `lireErreur`, `messageErreur` | Erreurs `{ code, message, details }` affichables |
| `api.get / post / patch`, `qs(params)` | Raccourcis |

### 10.2 Session — `auth/AuthContext.tsx`, `auth/RouteProtegee.tsx`, `auth/roles.ts`

- `AuthProvider` : au démarrage, `rafraichirSession()` puis `GET /auth/moi` (le jeton en mémoire est perdu à chaque rechargement) ; `connecter(identifiant, mdp)`, `deconnecter()` ; `oublierSession` vide le cache de TanStack Query.
- `RouteProtegee({ roles })` : « Vérification de la session… » → pas connecté → `/connexion` (en mémorisant la page) → mauvais rôle → son espace (`ESPACE_DU_ROLE`).
- `MENU_DU_ROLE` : liens de navigation par rôle.

### 10.3 Données — `lib/requetes.ts`, `main.tsx`

`useCategories`, `useMenusPublies`, `useMenus`, `useArticles`, `useChambres(etat)` (TanStack Query). `main.tsx` : `QueryClient` avec `staleTime` 30 s et **pas de réessai sur une erreur 4xx**. Après chaque mutation : `invalidateQueries`.

### 10.4 Écrans par rôle (`pages/`)

| Espace | Fichiers | Mécanismes notables |
|---|---|---|
| Public | `public/Accueil.tsx`, `Connexion.tsx`, `Inscription.tsx` | catégories + menus publiés |
| Client | `client/Reserver.tsx`, `MesReservations.tsx`, `MesFactures.tsx`, `PaiementRetour.tsx` | **`Idempotency-Key`** créée par `useRef(crypto.randomUUID())` dans `components/FormulaireReservation.tsx` ; `MesReservations` se rafraîchit toutes les 3 s tant qu'un paiement est attendu ; `PaiementRetour` **interroge** `GET /paiements/:id` toutes les 2 s (60 s max) — `successUrl` n'est pas une preuve |
| Réception | `reception/Reservations.tsx`, `NouvelleReservation.tsx`, `Departs.tsx`, `Chambres.tsx`, `Factures.tsx`, `ModaleCheckIn.tsx` | check-in : case « pièce vérifiée » ; sur 422 « pas propre », choix d'une chambre PROPRE de la même catégorie |
| Ménage | `menage/Taches.tsx` | terminer avec les 4 articles pré-remplis à 1 |
| Restaurant | `restaurant/PriseCommande.tsx` (panier `Record<platId, quantité>`), `SuiviCommandes.tsx`, `Menus.tsx` | imputer à une chambre ou facturer + encaisser |
| Communication | `communication/Communication.tsx` | publier, texte Facebook à copier |
| Comptable | `comptable/Tableaux.tsx`, `Reversements.tsx`, `CopiesFactures.tsx`, `Stock.tsx` | écarts en rouge |
| Admin | `admin/Comptes.tsx`, `Categories.tsx`, `ChambresAdmin.tsx` | gestion des comptes, catégories, chambres |

Composants partagés : `components/BoutonPayer.tsx` (`POST /paiements` puis `window.location.href = url`), `Encaissement.tsx`, `DetailFacture.tsx`, `RecapReservation.tsx`, `Layout.tsx`, `ui.tsx`. Types : `lib/types.ts`. Formats : `lib/format.ts` (`libelle`, montants en Ar).

---

## 11. Infrastructure, scripts et tests

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | PostgreSQL 17, Redis (`noeviction`) ; profil `app` : 8 services (image unique), front nginx (8080), faux Papi (4010) ; seuls gateway/front/faux Papi publient un port |
| `docker/app.Dockerfile`, `docker/demarrer.sh` | Image unique ; au démarrage : `prisma migrate deploy` puis `node dist/server.js` (`SERVICE=…`) |
| `docker/web.Dockerfile`, `docker/nginx.conf` | Build Vite + nginx ; `/api` → gateway ; repli SPA sur `index.html` |
| `docker/postgres/init.sql` | Une base par service (+ bases de test), au premier démarrage du volume |
| `scripts/generer-env-docker.sh` | Secrets du `.env` racine (jamais écrasé) |
| `scripts/seed.sh` | Données de démo **par l'API**, strict et rejouable |
| `scripts/scenario-*.sh` | Scénarios de bout en bout (dont `scenario-complet.sh` : 8 services) |
| `scripts/creer-service.sh` | Squelette d'un nouveau service |
| `services/*/vitest.config.ts` + `tests/preparation-globale.ts` | Base `<service>_test_db` migrée (`migrate deploy`), préfixe Redis de test par service |

---

## 12. Catalogue des événements : qui émet, qui consomme

| Événement | Émis par (fonction) | Consommé par (fonction) | Effet |
|---|---|---|---|
| `reservation.creee` | hebergement `creerReservation` | facturation `traiterReservationCreee` | facture SEJOUR émise |
| `reservation.confirmee` | hebergement `confirmerDansTransaction` | — (notification, V2) | — |
| `paiement.recu` | facturation `appliquerPaiement` | hebergement `traiterPaiementRecu` · restaurant `traiterPaiementRecu` | réservation CONFIRMEE · commande PAYEE |
| `sejour.commence` | hebergement `faireCheckIn` | menage `traiterSejourCommence` | tâches QUOTIDIEN |
| `sejour.termine` | hebergement `faireCheckOut` | menage `traiterSejourTermine` · facturation `traiterSejourTermine` | tâche DEPART · clôture si soldée |
| `menage.termine` | menage `terminerTache` | hebergement `traiterMenageTermine` · stock `traiterMenageTermine` | chambre PROPRE · sortie des articles |
| `consommation.imputee` | restaurant `imputerALaChambre` | facturation `traiterConsommationImputee` | ligne RESTAURANT sur la facture du séjour |
| `facture.cloturee` | facturation `cloturerDansTransaction` | comptabilite `traiterFactureCloturee` | copie + reversement |
| `stock.seuil_atteint` | stock `bougerStock` | — (notification, V2) | — |

Toujours le même mécanisme : `ecrireEvenement` **dans** la transaction → `relayerOutbox` (2 s) → `bus.publier` (une file par abonné) → `bus.consommer` → `traiterUneFois` (ou une contrainte UNIQUE) chez le consommateur.

---

## 13. Index des techniques

| Technique | Où la voir dans le code |
|---|---|
| Contrainte `EXCLUDE` (anti-surbooking) | migration `contraintes_metier` de hebergement ; `creerReservation`, `faireCheckIn` |
| Contraintes `CHECK` (base = dernier rempart) | `facture_pas_de_surpaiement`, `stock_jamais_negatif`, `reservation_dates_coherentes`… (migrations) |
| Index unique **partiel** | `paiement_un_en_attente_par_facture` (facturation) |
| Écriture conditionnelle `updateMany` + `count` | `confirmerDansTransaction`, `expirerReservation`, `traiterNotification`, `demarrerTache`, `rafraichir` (auth), `effectuerReversement` |
| Verrouillage optimiste (`version`) | réservations, chambres, commandes |
| Compteur atomique (`upsert` + `increment`) | `prochaineReference`, `prochainNumero`, `creerCommande` |
| Décrément atomique | `bougerStock` |
| Outbox | `ecrireEvenement` + `relayerOutbox` (tous les émetteurs) |
| Consommateur idempotent | `traiterUneFois` / `evenement_traite` ; `UNIQUE` (stock, menage) |
| Idempotency-Key | `relireIdempotence`, `cle_idempotence` ; front `FormulaireReservation` |
| Jobs BullMQ différés / répétables | `planifierExpiration` ; `upsertJobScheduler` (relais, balayage, purge, 23 h) |
| Snapshot entre services (id sans FK) | `SnapshotSejour`, `clientNom`, `chambreNumero`, `platNom`, `prixUnitaire`, `copie_facture` |
| REST synchrone entre services + clé interne | `lireReservation`, `sejourEnCours`, `creerFactureRestaurant`, `lireNomEmploye`, `nuiteesVendues` |
| JWT EdDSA, rotation de session | `jetons.ts`, `session.service.ts` ; `authentification.ts` (gateway) |
| scrypt + sel + temps constant | `mot-de-passe.ts` |
| Secrets stockés hachés | `jetonHash`, `notificationTokenHash`, `session.jetonHash` |
| Refus par défaut, RBAC | `regles.ts`, `app.ts` (gateway) |
| Validation Zod (entrée, env, événements, réponses externes) | `*.schema.ts`, `config/env.ts`, `evenements.ts`, `papi.ts`, `hebergement.ts` |
| Prédicat de type (sans cast) | `estEnveloppe` |
| Machine à états | `transitions.ts` (réservation), `TRANSITIONS` (commande) |
| Fuseau horaire explicite | `temps.ts`, job 23 h |
| Jeton d'accès en mémoire + rafraîchissement unique | `apps/web/src/lib/api.ts` |
| Sondage (polling) au lieu de croire la redirection | `PaiementRetour.tsx` |
