# @hotel/web — interface React

Front de l'application « Hôtel & Restaurant » : React + Vite + TypeScript, React Router,
TanStack Query, react-hook-form + Zod 4, Tailwind CSS 4.

## Lancer

```bash
pnpm install
pnpm dev:gateway                 # la gateway doit tourner sur http://localhost:3000 (avec les services)
pnpm --filter @hotel/web dev     # http://localhost:5173
```

Vite transmet tout ce qui commence par `/api` à la gateway (`vite.config.ts`). Front et API sont donc
sur la même origine en développement : le cookie de session (httpOnly, SameSite=Strict, Path=/api/auth)
est bien envoyé par le navigateur.

Autres commandes :

```bash
pnpm --filter @hotel/web typecheck   # vérification TypeScript
pnpm --filter @hotel/web build       # typecheck + build de production dans dist/
```

## Structure

```
src/
  main.tsx               point d'entrée (QueryClient, routeur, AuthProvider)
  App.tsx                plan des routes, protégées par rôle
  lib/
    api.ts               client fetch : jeton, rafraîchissement, erreurs typées (ApiError)
    types.ts             types des réponses de l'API
    requetes.ts          lectures partagées (catégories, menus, articles, chambres)
    format.ts            Ariary, dates, libellés français des statuts
    validation.ts        règles Zod communes (téléphone malgache, email, entiers…)
  auth/
    AuthContext.tsx      session : restauration au démarrage, connexion, déconnexion
    RouteProtegee.tsx    garde de route par rôle
    roles.ts             espace d'accueil et menu de chaque rôle
  components/            UI réutilisable (ui.tsx, Layout, formulaire de réservation, facture, paiement…)
  pages/
    public/              accueil, connexion, inscription
    client/              réserver, mes réservations, mes factures, retour de paiement
    reception/           réservations, comptoir, départs, check-in, factures, chambres
    menage/              tâches du jour
    restaurant/          menus et plats, prise de commande, suivi des commandes
    communication/       publication des menus, texte Facebook, grille tarifaire
    comptable/           tableaux journaliers, reversements, copies de factures, stock
    admin/               comptes, catégories, chambres (articles : écran Stock)
```

## Authentification

- **Jeton d'accès en mémoire** : le JWT renvoyé par `POST /api/auth/connexion` est gardé dans une
  variable du module `lib/api.ts`, jamais dans `localStorage` (un script malveillant ne peut pas le lire
  après coup). Il est ajouté à chaque appel : `Authorization: Bearer <jeton>`.
- **Session longue = cookie httpOnly** posé par le serveur. Au chargement de l'application, le jeton
  (perdu au rechargement) est récupéré par `POST /api/auth/rafraichir`, puis l'utilisateur par
  `GET /api/auth/moi`.
- **Rafraîchissement unique partagé** : si une requête reçoit un 401, elle appelle
  `rafraichirSession()`. Toutes les requêtes qui échouent en même temps attendent la **même promesse**,
  donc un seul appel à `/auth/rafraichir` part ; chaque requête est ensuite rejouée une fois.
  Entre plusieurs onglets, un verrou du navigateur (Web Locks API) évite que deux onglets envoient le
  même ancien cookie en même temps (le serveur révoquerait alors toutes les sessions).
- Si le rafraîchissement échoue, la session est vidée et les routes protégées renvoient vers `/connexion`.
- Après connexion, chaque rôle est redirigé vers son espace (`auth/roles.ts`). Les gardes de route ne sont
  qu'un confort d'affichage : les droits réels sont vérifiés par la gateway.

## Paiement Papi

`POST /api/paiements` avec `{ reservationId }` ou `{ factureId }` (jamais de montant) renvoie l'URL de
Papi, vers laquelle le navigateur est redirigé. Au retour, `/paiement/retour?paiement=<id>` ne prouve
rien : la page interroge `GET /api/paiements/:id` toutes les 2 s (60 s au plus) et affiche le statut
connu du serveur.
