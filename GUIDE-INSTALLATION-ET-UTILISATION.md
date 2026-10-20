# Hôtel & Restaurant — Installation et guide d'utilisation

Ce document explique comment installer l'application, la remplir avec des données de démonstration, puis l'utiliser, rôle par rôle. La partie 1 s'adresse à la personne qui installe ; la partie 2 aux utilisateurs (réception, ménage, restaurant, comptabilité, clients).

Version de l'application : 1.0.0.

---

# Partie 1 — Installation

## 1.1 Ce qu'il faut installer avant

| Logiciel | Version | Utile pour | Vérifier avec |
|---|---|---|---|
| **Docker** + **Docker Compose v2** | Docker 24 ou plus récent | faire tourner toute l'application | `docker --version` et `docker compose version` |
| **Node.js** | **24.x** (testé avec 24.21.0) | les scripts d'installation (clés, données de démo) | `node --version` |
| **pnpm** | **12.5.1** | seulement en mode développement (section 1.4) | `pnpm --version` |
| **bash**, **curl**, **openssl** | toute version récente | les scripts d'installation | `bash --version` |

- **Linux et macOS** : tout fonctionne directement.
- **Windows** : utiliser **WSL 2** (Ubuntu) et Docker Desktop avec l'intégration WSL activée. Toutes les commandes se tapent dans le terminal Ubuntu.
- **Installer Node 24** : depuis https://nodejs.org (version « LTS 24 »), ou avec `nvm install 24`.
- **Installer pnpm 12.5.1** (mode développement seulement) : `corepack enable` puis `corepack prepare pnpm@12.5.1 --activate`. Corepack est fourni avec Node.
- La machine doit avoir **au moins 4 Go de mémoire vive** et **5 Go d'espace disque libre** (images Docker).

Ports utilisés sur la machine : **8080** (application), **3000** (API), **4010** (faux Papi), **5432** (PostgreSQL), **6381** (Redis). Ils doivent être libres.

## 1.2 Ce que contient le dossier

```
hotel-restaurant/
├── apps/web/           l'interface (React), servie sur le port 8080
├── services/           les 8 services : api-gateway, auth, hebergement, facturation,
│                       menage, stock, restaurant, comptabilite
├── packages/commun/    le code partagé par les services
├── docker/             la construction des images et la création des bases
├── scripts/            génération des secrets, données de démonstration, scénarios de test
└── docker-compose.yml  la description de tous les conteneurs
```

Il n'y a **aucun fichier secret** dans le dossier (fichiers `.env`). Chaque installation génère les siens à l'étape 1 ci-dessous.

## 1.3 Installation avec Docker (recommandée)

C'est la méthode la plus simple : Docker construit et lance tout. **Ni `pnpm install` ni base de données à préparer à la main** : les images installent leurs dépendances, et chaque service applique ses migrations au démarrage.

Toutes les commandes se tapent **à la racine du dossier** `hotel-restaurant`.

### Étape 1 — Générer les secrets

```bash
bash scripts/generer-env-docker.sh
```

Crée le fichier `.env` à la racine avec une clé interne aléatoire (partagée par les services) et une paire de clés pour signer les connexions. Le script refuse d'écraser un `.env` existant.

### Étape 2 — Construire et démarrer l'application

```bash
docker compose --profile app up -d --build
```

- La **première fois**, la construction prend **5 à 15 minutes** (téléchargement et compilation). Les fois suivantes, quelques secondes.
- Ce qui démarre : PostgreSQL, Redis, les 8 services, l'interface et le faux Papi (paiement de démonstration).
- **Les bases de données** sont créées automatiquement au premier démarrage de PostgreSQL (`docker/postgres/init.sql` : une base par service, plus une base de test chacune).
- **Les migrations** (création des tables) sont appliquées automatiquement par chaque service à son démarrage (`prisma migrate deploy`).

Vérifier que tout tourne (attendre environ 30 secondes après la commande) :

```bash
docker compose --profile app ps        # tous les conteneurs doivent être « Up » (postgres : « healthy »)
curl http://localhost:3000/health      # {"status":"ok","service":"api-gateway"}
curl http://localhost:3000/api/categories   # [] (liste vide : normal avant les données de démo)
```

### Étape 3 — Créer le compte administrateur

Choisir un mot de passe d'au moins 10 caractères, puis remplacer `MotDePasse-Admin-2026` dans la commande :

```bash
docker compose exec \
  -e ADMIN_TELEPHONE=0340000001 \
  -e ADMIN_EMAIL=direction@hotel-tana.mg \
  -e ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' \
  auth node dist/scripts/creer-admin.js
```

Réponse attendue : `Compte ADMIN créé : 0340000001 (direction@hotel-tana.mg)`.

### Étape 4 — Charger les données de démonstration (seed)

```bash
ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' SEED_MOT_DE_PASSE='Demo-Tana-2026' bash scripts/seed.sh
```

- `ADMIN_MOT_DE_PASSE` : celui choisi à l'étape 3.
- `SEED_MOT_DE_PASSE` : le mot de passe donné à **tous** les comptes de démonstration (10 caractères minimum).

Le script crée, **en passant par l'application** (les mêmes règles que pour un vrai utilisateur) :
- 3 catégories de chambres et 12 chambres (101 à 106, 201 à 204, 301 et 302) ;
- 7 comptes du personnel et 1 client (tableau 1.5) ;
- 4 articles d'accueil avec 200 unités chacun (gel douche, papier hygiénique, pantoufles, brosse à dents) ;
- une carte de restaurant publiée de 11 plats et boissons malgaches.

Le script peut être relancé sans danger : ce qui existe déjà est conservé. Il s'arrête avec un message `ÉCHEC …` au moindre problème.

### Étape 5 — Ouvrir l'application

Ouvrir **http://localhost:8080** dans un navigateur, puis se connecter avec un compte du tableau 1.5.

Depuis un autre appareil du même réseau (téléphone, tablette) : **http://ADRESSE-IP-DE-LA-MACHINE:8080**. L'adresse IP s'obtient avec `hostname -I` sous Linux ou `ipconfig` sous Windows.

### Arrêter, redémarrer, tout effacer

```bash
docker compose --profile app stop       # arrêter (les données sont conservées)
docker compose --profile app up -d      # redémarrer
docker compose --profile app down       # supprimer les conteneurs (les données sont conservées)
docker compose --profile app down -v    # TOUT effacer, données comprises (repartir de l'étape 2)
```

## 1.4 Installation en mode développement (pour modifier le code)

À utiliser seulement pour **travailler sur le code**. Les services tournent directement avec Node ; seuls PostgreSQL et Redis tournent dans Docker.

### Étape 1 — Dépendances

```bash
docker compose up -d                 # PostgreSQL et Redis seulement (crée aussi les bases)
pnpm install                         # installe les dépendances de tous les paquets
pnpm build:commun                    # compile le code partagé (à refaire après chaque modification de packages/commun)
```

### Étape 2 — Les fichiers `.env` de chaque service

Pour chacun des 8 dossiers de `services/`, copier le modèle :

```bash
for s in services/*/; do cp -n "$s.env.example" "$s.env"; done
```

Puis compléter :

1. **Clé interne** : générer une valeur avec `openssl rand -hex 32`, et la mettre dans `CLE_INTERNE=` de **tous** les fichiers `services/*/.env` (la même valeur partout).
2. **Clés de connexion** : `pnpm --filter @hotel/auth generer-cles` affiche deux lignes. Copier `JWT_CLE_PRIVEE=…` dans `services/auth/.env`, et `JWT_CLE_PUBLIQUE=…` dans `services/api-gateway/.env`.
3. **Paiement de démonstration** : dans `services/facturation/.env`, mettre `PAPI_BASE_URL=http://localhost:4010` et `PUBLIC_URL=http://localhost:3000`.

### Étape 3 — Clients de base de données et migrations

```bash
pnpm -r --filter "./services/*" --filter "!@hotel/api-gateway" exec prisma generate
pnpm -r --filter "./services/*" --filter "!@hotel/api-gateway" exec prisma migrate deploy
```

- `prisma generate` crée le code d'accès à la base de chaque service (dans `src/generated/`, non fourni dans le dossier).
- `prisma migrate deploy` crée les tables dans chaque base.

### Étape 4 — Démarrer

Dans deux terminaux :

```bash
pnpm dev                                    # terminal 1 : les 8 services et leurs workers
pnpm --filter @hotel/facturation faux-papi  # terminal 2 : le faux Papi (port 4010)
```

### Étape 5 — Administrateur et données de démonstration

```bash
cd services/auth
ADMIN_TELEPHONE=0340000001 ADMIN_EMAIL=direction@hotel-tana.mg ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' pnpm creer-admin
cd ../..
ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' SEED_MOT_DE_PASSE='Demo-Tana-2026' bash scripts/seed.sh
```

Puis ouvrir **http://localhost:5173**.

### Tests automatisés

```bash
pnpm typecheck     # vérification TypeScript de tous les paquets
pnpm test          # tests de tous les services (sur des bases *_test_db séparées, jamais sur les données réelles)
```

## 1.5 Comptes de test (après le seed)

Mot de passe de tous ces comptes : la valeur de `SEED_MOT_DE_PASSE` (`Demo-Tana-2026` dans les exemples), **sauf l'administrateur**, qui a celui choisi à l'étape 3. On se connecte avec le **téléphone** ou l'**email**.

| Rôle | Nom | Téléphone | Email | Page d'arrivée |
|---|---|---|---|---|
| Administrateur | Direction | 0340000001 | direction@hotel-tana.mg | Comptes |
| Réceptionniste | Soa Randriamanana | 0341000001 | reception@hotel-tana.mg | Réservations |
| Femme de ménage | Hanta Rasoanirina | 0341000002 | hanta.menage@hotel-tana.mg | Tâches du jour |
| Femme de ménage | Voahangy Rakotobe | 0341000003 | voahangy.menage@hotel-tana.mg | Tâches du jour |
| Restaurant | Tovo Andrianjafy | 0341000004 | restaurant@hotel-tana.mg | Prise de commande |
| Comptable | Fara Ravelojaona | 0341000005 | comptabilite@hotel-tana.mg | Tableaux journaliers |
| Communication | Mialy Rabemananjara | 0341000006 | communication@hotel-tana.mg | Menus et tarifs |
| Client | Jean Rakoto | 0331234567 | jean.rakoto@mail.mg | Réserver |

Après **10 tentatives de connexion ratées en 15 minutes** depuis la même adresse, l'application bloque temporairement les essais : patienter 15 minutes, puis réessayer.

## 1.6 Le paiement

**Par défaut, le paiement passe par un faux Papi** (http://localhost:4010) : aucune vraie transaction. La page affiche le montant et deux boutons, **Payer** ou **Refuser**, puis prévient l'application exactement comme le ferait le vrai Papi.

**Pour utiliser le vrai Papi.mg en mode test** (sandbox) :
1. Rendre l'API joignable depuis Internet : `cloudflared tunnel --url http://localhost:3000` affiche une adresse `https://….trycloudflare.com`.
2. Dans le `.env` racine, décommenter et remplir `PAPI_BASE_URL=https://app.papi.mg`, `PAPI_API_KEY=` (la clé du compte marchand) et `PUBLIC_URL=` (l'adresse du tunnel).
3. Relancer le service : `docker compose --profile app up -d facturation`.
4. Numéros de test MVola de la sandbox : `0341230001` (paiement réussi), `0341230002` (solde insuffisant), `0341230003` (numéro invalide).

L'adresse d'un tunnel rapide change à chaque lancement : il faut alors mettre à jour `PUBLIC_URL` et relancer facturation.

## 1.7 En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| `scripts/generer-env-docker.sh` : « .env existe déjà » | le `.env` a déjà été créé | rien à faire, passer à l'étape 2 (ne pas le supprimer si des données existent : les connexions seraient invalidées) |
| La construction s'arrête avec « no space left on device » | disque plein | `docker system prune` puis relancer ; garder 5 Go libres |
| `port is already allocated` | un autre programme utilise 8080, 3000, 5432… | arrêter ce programme, ou libérer le port |
| La page affiche « Service momentanément indisponible » | un service n'a pas encore démarré | attendre 30 secondes ; sinon `docker compose --profile app logs <service>` |
| Erreur 500 juste après avoir allumé l'ordinateur | PostgreSQL termine son démarrage | attendre quelques secondes et réessayer |
| Le seed affiche `ÉCHEC POST /auth/connexion → HTTP 401` | mauvais mot de passe administrateur | utiliser celui de l'étape 3 |
| Le seed affiche `ÉCHEC … HTTP 000` ou 502 | l'application ne tourne pas | refaire la vérification de l'étape 2 |
| Mode développement : un service s'arrête avec `Variables d'environnement invalides` | une ligne manque dans son `.env` | le message nomme la variable : la compléter (section 1.4, étape 2) |
| Mode développement : `ECONNREFUSED … 6381` | Redis est arrêté | `docker compose up -d redis` |
| Un paiement reste « en attente » | la notification n'est pas arrivée | vérifier que le faux Papi tourne (`curl http://localhost:4010`) ; avec le vrai Papi, vérifier le tunnel |

---

# Partie 2 — Guide d'utilisation

## 2.1 Le principe de l'application

L'application suit le parcours d'un client dans l'hôtel :

1. Le client **réserve** une catégorie de chambre (en ligne, ou au comptoir). L'hôtel choisit la chambre.
2. Il **paie** avec Papi (MVola, Airtel Money, Orange Money ou carte) **dans les 30 minutes**. Sinon, la réservation est annulée automatiquement et la chambre est libérée.
3. Le jour de l'arrivée, la réception fait le **check-in** : pièce d'identité vérifiée, chambre **propre** obligatoire.
4. Pendant le séjour, le **ménage** est fait chaque jour ; les articles d'accueil remplacés sortent du **stock**.
5. Les repas pris au **restaurant** peuvent être payés sur place ou **ajoutés à la facture de la chambre**.
6. Au départ, la réception fait le **check-out**, encaisse le reste éventuel et **clôture la facture**.
7. Une copie de chaque facture clôturée part à la **comptabilité**, qui reverse au restaurant l'argent des repas encaissé par l'hôtel, et reçoit chaque soir à **23 h** un tableau de bord.

Chaque personne ne voit que les écrans de son rôle. Le menu en haut de l'écran change selon le compte connecté. Les montants sont en Ariary (Ar) et les heures sont celles de Madagascar.

## 2.2 Visiteur et client

**Sans compte** (page d'accueil) : voir les catégories de chambres, leurs prix, et la carte du restaurant.

**Créer un compte** : bouton « Créer un compte » → nom, téléphone malgache (ex. 034 12 345 67), email, mot de passe (10 caractères minimum), langue.

**Réserver une chambre** (menu « Réserver ») :
1. Choisir la **catégorie** et les **dates**. Une estimation du prix s'affiche ; le montant exact est calculé par l'hôtel.
2. Vérifier ses coordonnées et indiquer sa **pièce d'identité** (CIN ou passeport).
3. Cliquer sur **Réserver**. La réservation est enregistrée avec une référence (ex. RES-2026-000001), le numéro de chambre et le montant total.
4. Cliquer sur **Payer avec Papi** : la page de paiement s'ouvre. Après le paiement, l'application revient sur « Résultat du paiement » et affiche **Réussi** quand le paiement est confirmé.

La chambre est bloquée **30 minutes**. Le temps restant s'affiche (« À payer avant 11:19, encore 28 min »). Sans paiement, la réservation passe à « Annulée ».

Si le message « Aucune chambre de cette catégorie n'est disponible » s'affiche, essayer d'autres dates ou une autre catégorie.

**Mes réservations** : toutes les réservations et leur statut. Une réservation en attente peut être payée depuis cet écran ; la liste se met à jour seule pendant que la confirmation arrive.

| Statut | Signification |
|---|---|
| En attente de paiement | réservée, à payer dans les 30 minutes |
| Confirmée | payée, en attente de l'arrivée |
| En cours | le client est à l'hôtel |
| Terminée | le client est parti |
| Annulée | non payée à temps, ou annulée par la réception |

**Mes factures** : le détail de chaque facture (nuits, repas ajoutés) et son statut (Émise, Payée, Clôturée).

## 2.3 Réceptionniste

**Réservations** : la liste de toutes les réservations, filtrable par statut. Les boutons de chaque ligne :
- **Check-in** (réservation confirmée, le jour de l'arrivée) : cocher « J'ai vérifié la pièce d'identité du client », puis **Valider le check-in**. Si la chambre prévue n'est pas propre, l'application le dit et propose de choisir **une autre chambre propre de la même catégorie** (« Faire le check-in dans cette chambre »).
- **Check-out** (séjour en cours) : termine le séjour. La chambre passe « Sale » et une tâche de ménage est créée.
- **Annuler** : annule une réservation en attente ou confirmée.
- Le détail d'une réservation permet de **générer un lien de paiement Papi** à transmettre au client.

**Nouvelle réservation** : réserver au comptoir pour un client (même formulaire que le client, avec le **canal** : Réception, Facebook ou Site web). Le paiement peut ensuite se faire par lien Papi ou en espèces.

**Départs du jour** : les séjours dont la date de départ est arrivée, avec le bouton **Check-out**. Avant de clôturer, vérifier que la facture est soldée (écran Factures).

**Factures** : toutes les factures, filtrables par statut. **Ouvrir** une facture affiche ses lignes (nuits, repas du restaurant), ses paiements et le reste à payer :
- **Encaisser en espèces** : saisir le montant (au plus le reste à payer).
- **Clôturer la facture** : possible seulement quand elle est entièrement payée. Une copie part automatiquement à la comptabilité.

**Chambres** : l'état de chaque chambre (Propre, Sale, En nettoyage), filtrable. Une chambre redevient « Propre » automatiquement quand la femme de ménage termine sa tâche.

**Ménage** : consulter les tâches de ménage du jour (sans pouvoir les démarrer).

## 2.4 Femme de ménage

**Tâches du jour** : une carte par chambre à nettoyer. Les **ménages de départ** (chambre à préparer pour le client suivant) apparaissent en premier, puis les **ménages quotidiens**.

1. **Démarrer** : la tâche vous est attribuée (votre nom s'affiche). Si une collègue l'a prise juste avant, l'application le signale.
2. **Terminer** : indiquer les articles **réellement** remplacés (1 de chaque par défaut : gel douche, papier hygiénique, pantoufles, brosse à dents), ajouter une remarque si besoin (« ampoule à changer »), puis **Valider : chambre propre**.

Ensuite, automatiquement : la chambre redevient « Propre » pour la réception, et les articles sont retirés du stock.

Seule la personne qui a démarré une tâche peut la terminer. On peut changer la date pour voir les tâches d'un autre jour.

## 2.5 Restaurant

**Prise de commande** : cliquer sur **+ Ajouter** pour chaque plat, ajuster les quantités avec **−** et **+**, choisir **Sur place** (avec le numéro de table) ou **À emporter**, puis **Envoyer la commande**. Le prix est toujours celui de la carte.

**Suivi des commandes** : les commandes du moment (la liste se met à jour toute seule).
- Faire avancer une commande : **Lancer la préparation**, puis **Marquer prête**, puis **Marquer remise au client**.
- **Régler la commande**, deux possibilités :
  - **Imputer à une chambre** : saisir le numéro de chambre d'un client **en séjour**, puis **Ajouter à la facture de la chambre**. Le montant s'ajoute à sa facture d'hôtel. Si personne n'occupe la chambre, l'application refuse.
  - **Facturer et encaisser** : crée une facture restaurant et permet d'encaisser en espèces.
- **Annuler** : seulement tant que la commande n'est ni payée ni imputée.

**Menus et plats** : créer un menu (**Créer le menu**), y ajouter des plats (**+ Ajouter un plat** : nom, catégorie, prix, temps de préparation, description), **Changer le prix** d'un plat, ou le **Marquer épuisé** / **Remettre disponible**. Un plat épuisé disparaît de la prise de commande et du site.

## 2.6 Communication

**Menus et tarifs** :
- **Publier** / **Dépublier** un menu : un menu publié apparaît sur la page d'accueil du site.
- **Texte Facebook** : génère le texte du menu prêt à publier sur la page Facebook de l'hôtel, avec un bouton **Copier**.
- La **grille tarifaire** des chambres, à reprendre dans les publications.

## 2.7 Comptable

**Tableaux journaliers** : un tableau par jour, généré automatiquement **chaque soir à 23 h** (ou à la demande : choisir le jour puis **Générer**). Il contient :
- les nuitées vendues et leur répartition par canal (site web, réception, Facebook) ;
- le nombre de factures clôturées, le chiffre d'affaires hébergement et restaurant ;
- le **contrôle du stock** : pour chaque article, la consommation attendue (1 par nuitée vendue la veille), la consommation réelle déclarée par le ménage, et **l'écart**. Un écart différent de zéro est signalé : il est à transmettre à la direction.

**Reversements** : l'argent des repas **ajoutés aux factures de chambre** a été encaissé par l'hôtel mais appartient au restaurant. Chaque facture concernée crée un reversement « À reverser ». Une fois l'argent remis au restaurant, cliquer sur **Marquer reversé**.

**Copies de factures** : toutes les factures clôturées, par jour de clôture, avec la part hébergement et la part restaurant.

**Stock** : la quantité de chaque article ; les articles sous leur seuil d'alerte sont en rouge (« Stock bas »).
- **Mouvement** : enregistrer un approvisionnement (entrée), une perte (sortie) ou un ajustement d'inventaire, avec la quantité.
- **Historique** : tous les mouvements d'un article, y compris les sorties faites par le ménage.

## 2.8 Administrateur

L'administrateur a accès à tous les écrans de gestion, plus la réception, la comptabilité, les menus et la communication.

- **Comptes** : créer un compte du personnel (nom, téléphone, email, mot de passe, rôle), **Désactiver** ou **Réactiver** un compte. Un compte désactivé est déconnecté et ne peut plus se connecter.
- **Catégories** : créer une catégorie de chambre (code, libellé, capacité, tarif par nuit) ; voir le nombre de chambres de chacune.
- **Chambres** : créer une chambre (numéro, étage, catégorie).
- **Articles** : créer un article d'accueil (code, libellé, seuil d'alerte, consommation par nuitée). Les mouvements de stock se font comme pour le comptable (section 2.7).

## 2.9 Scénario de démonstration complet (15 minutes)

Pour découvrir toute l'application, ouvrir deux fenêtres de navigation privée, afin d'être connecté avec deux comptes en même temps.

1. **Client** (0331234567) : réserver une Suite senior pour **aujourd'hui → demain**, puis **Payer avec Papi** → **Payer** sur la page du faux Papi. Le résultat affiche « Réussi », et la réservation passe « Confirmée ».
2. **Réception** (0341000001) : Réservations → **Check-in** de la réservation, en cochant la pièce d'identité.
3. **Restaurant** (0341000004) : Prise de commande → un Romazava et une THB → Envoyer. Puis Suivi des commandes → **Imputer à une chambre** → numéro de la chambre du client.
4. **Client** : Mes factures → la facture contient maintenant la ligne du restaurant, et il reste ce montant à payer.
5. **Réception** : Réservations → **Check-out**. Puis Factures → Ouvrir → **Encaisser en espèces** le reste → **Clôturer la facture**.
6. **Femme de ménage** (0341000002) : la tâche « Ménage de départ » de la chambre est apparue → **Démarrer** → **Terminer** → **Valider : chambre propre**. Côté réception, l'écran Chambres affiche de nouveau la chambre « Propre ».
7. **Comptable** (0341000005) : Copies de factures (la facture clôturée), Reversements (le montant du repas « À reverser » → **Marquer reversé**), Tableaux journaliers → **Générer** pour aujourd'hui, Stock (gel douche, etc. : 199).
8. **Communication** (0341000006) : Menus et tarifs → **Texte Facebook** → **Copier**.
