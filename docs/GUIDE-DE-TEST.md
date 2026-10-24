# Guide de test — Hôtel & Restaurant (v1.1)

Objectif : vérifier **chaque fonctionnalité** à la main, rôle par rôle, en cochant au fur et à mesure.
Chaque test indique **quoi faire** et **le résultat attendu**. Si le résultat diffère, noter l'écran, l'action
et le message affiché.

---

## 0. Préparer l'environnement (une seule fois)

Dans un terminal WSL, depuis `/mnt/d/hotel-restaurant` :

```bash
docker compose up -d                                   # PostgreSQL (5432) + Redis (6381)
pnpm install && pnpm build:commun
pnpm -r --filter "./services/*" --filter "!@hotel/api-gateway" exec prisma generate
pnpm -r --filter "./services/*" --filter "!@hotel/api-gateway" exec prisma migrate deploy
```

Puis, dans deux terminaux :

```bash
pnpm dev                # terminal 1 :les 8 services, leurs workers et l'interface sur http://localhost:5173
pnpm --filter @hotel/facturation faux-papi  # terminal 2 : faux Papi (port 4010) — inutile avec le vrai Papi
```

Premier administrateur et données de démonstration :

```bash
cd services/auth
ADMIN_TELEPHONE=0340000001 ADMIN_EMAIL=direction@hotel-tana.mg ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' pnpm creer-admin
cd ../..
ADMIN_MOT_DE_PASSE='MotDePasse-Admin-2026' SEED_MOT_DE_PASSE='Demo-Tana-2026' bash scripts/seed.sh
```

**Paiement** : avec le faux Papi, `services/facturation/.env` doit contenir `PAPI_BASE_URL=http://localhost:4010`
et `PUBLIC_URL=http://localhost:3000`. Avec le vrai Papi (sandbox) : `PAPI_BASE_URL=https://app.papi.mg`,
la vraie clé dans `PAPI_API_KEY`, et l'adresse de `cloudflared tunnel --url http://localhost:3000` dans `PUBLIC_URL`
(puis redémarrer facturation). Numéros MVola de test : `0341230001` (succès), `0341230002` (solde insuffisant).

**Comptes** (mot de passe `Demo-Tana-2026`, sauf l'admin) :

| Rôle | Téléphone |
|---|---|
| Administrateur | 0340000001 |
| Réceptionniste | 0341000001 |
| Femme de ménage | 0341000002 et 0341000003 |
| Restaurant | 0341000004 |
| Comptable | 0341000005 |
| Communication | 0341000006 |
| Client | 0331234567 |

**Astuce** : ouvrir une fenêtre normale et une fenêtre de navigation privée pour être connecté avec deux comptes.
Pour tester le **téléphone**, outils de développement (F12) → icône téléphone → largeur **360 px**.

**Vérification automatique** avant les tests manuels :

```bash
pnpm typecheck && pnpm test        # attendu : aucune erreur, tous les tests au vert
curl -s http://localhost:3000/health   # attendu : réponse 200 de la gateway
```

---

## 1. Interface commune (nouveautés v1.1)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 1.1 | Ouvrir http://localhost:5173 sur ordinateur | En-tête vert collé en haut, logo « H » terre cuite, pied de page sable | ☐ |
| 1.2 | Appuyer sur **Tab** dès l'ouverture de la page | Le lien « Aller au contenu » apparaît en haut à gauche ; Entrée saute au contenu | ☐ |
| 1.3 | Naviguer avec Tab dans toute une page | Chaque élément actif a un contour vert visible | ☐ |
| 1.4 | Largeur 360 px : toucher **☰ Menu** | Le menu s'ouvre (le bouton devient ✕) ; choisir un lien ferme le menu et change de page | ☐ |
| 1.5 | Se connecter en **ADMIN** sur ordinateur | Les 8 onglets tiennent sur une ligne qui défile horizontalement ; l'onglet actif est souligné en terre cuite | ☐ |
| 1.6 | Ouvrir n'importe quelle fenêtre (ex. détail de réservation) puis **Échap** | La fenêtre se ferme ; le focus revient sur le bouton qui l'avait ouverte | ☐ |
| 1.7 | Même fenêtre : cliquer sur le fond gris | La fenêtre se ferme | ☐ |
| 1.8 | Même fenêtre à 360 px | Elle s'ouvre comme une feuille collée en bas de l'écran ; la page derrière ne défile pas | ☐ |

## 2. Visiteur (sans compte)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 2.1 | Page d'accueil | Bandeau « Un séjour calme au cœur de Tana », 3 étapes numérotées, cartes des chambres avec prix « 85 000 Ar / nuit » | ☐ |
| 2.2 | Bouton **Réserver une chambre** (bandeau ou carte) | Redirige vers la connexion | ☐ |
| 2.3 | Section « Le restaurant » | Menus publiés groupés Entrée / Plat / Dessert / Boisson ; un plat épuisé est barré | ☐ |
| 2.4 | **Créer un compte** avec un téléphone invalide (`12345`) | Message d'erreur sous le champ, le compte n'est pas créé | ☐ |
| 2.5 | Créer un compte valide (mot de passe ≥ 10 caractères) | Connexion automatique, arrivée sur « Réserver » | ☐ |
| 2.6 | Se connecter 10 fois avec un mauvais mot de passe | Blocage temporaire (15 min) avec un message clair | ☐ |

## 3. Client (0331234567)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 3.1 | **Réserver** : catégorie + dates aujourd'hui → demain | Estimation du prix affichée | ☐ |
| 3.2 | Dates incohérentes (départ avant arrivée) | Erreur sous le champ, bouton bloqué | ☐ |
| 3.3 | Valider la réservation | Référence `RES-2026-…`, numéro de chambre, montant, compte à rebours de 30 min | ☐ |
| 3.4 | **Payer avec Papi** → **Payer** (faux Papi) ou MVola `0341230001` (sandbox) | Retour sur « Résultat du paiement » → **Réussi** ; la réservation passe **Confirmée** | ☐ |
| 3.5 | Nouvelle réservation, payer → **Refuser** (ou `0341230002`) | Résultat **Échoué** ; on peut réessayer | ☐ |
| 3.6 | Nouvelle réservation, ne pas payer pendant 30 min | Statut **Annulée** automatiquement, chambre libérée | ☐ |
| 3.7 | **Mes réservations** | Toutes mes réservations, avec badges colorés (point + texte) | ☐ |
| 3.8 | **Mes factures** | Détail des nuits, repas ajoutés, statut Émise / Payée / Clôturée | ☐ |
| 3.9 | Taper l'URL `/reception/reservations` | Renvoyé vers son espace « Réserver » ; et `curl` direct sur l'API répond 403 (la gateway refuse aussi) | ☐ |

## 4. Réceptionniste (0341000001)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 4.1 | **Réservations** | Pastilles « Toutes / Arrivées du jour / Départs du jour / Séjours en cours » avec leur nombre | ☐ |
| 4.2 | Pastille **Arrivées du jour** | Seules les réservations confirmées qui arrivent aujourd'hui (ou en retard) ; l'URL contient `?vue=arrivees` et survit à F5 | ☐ |
| 4.3 | Recherche : taper `rakoto` (sans majuscule ni accent) | La ligne de Jean Rakoto reste seule ; marche aussi avec la référence, le téléphone ou le n° de chambre | ☐ |
| 4.4 | Recherche sans résultat | Message « Aucune réservation ne correspond à … » + bouton **Tout afficher** | ☐ |
| 4.5 | Cliquer sur une **référence** (soulignée) | Fenêtre de détail ; si en attente de paiement : bouton pour générer le lien Papi | ☐ |
| 4.6 | **Check-in** d'une réservation confirmée sans cocher la pièce d'identité | Validation impossible | ☐ |
| 4.7 | Check-in avec la chambre prévue **sale** | Message + proposition d'une autre chambre propre de la même catégorie | ☐ |
| 4.8 | **Check-out** d'un séjour en cours | **Fenêtre de confirmation** (client, chambre, conséquences). **Revenir** n'envoie rien | ☐ |
| 4.9 | Confirmer le départ | Statut **Terminée**, chambre **Sale**, tâche « Départ » créée côté ménage ; si la facture était soldée, elle passe **Clôturée** toute seule | ☐ |
| 4.10 | **Annuler** (bouton rouge discret, séparé de Check-in) | Fenêtre de confirmation rouge ; après confirmation : **Annulée** | ☐ |
| 4.11 | **Nouvelle réservation** au comptoir, canal « Facebook » | Réservation créée ; lien de paiement ou espèces possibles | ☐ |
| 4.12 | **Départs du jour** | Séjours dont le départ est aujourd'hui, avec Check-out (confirmé) | ☐ |
| 4.13 | **Factures** → Ouvrir → **Encaisser en espèces** un montant > reste à payer | Refusé | ☐ |
| 4.14 | Encaisser le reste exact puis **Clôturer** | Facture **Clôturée** ; copie visible chez le comptable | ☐ |
| 4.15 | **Chambres** | État Propre / Sale / En nettoyage de chaque chambre, filtrable | ☐ |

## 5. Femme de ménage (0341000002) — tester à 360 px

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 5.1 | **Tâches du jour** | Sous-titre « N chambre(s) à faire sur M aujourd'hui » ; tâches en cours d'abord, terminées à la fin (grisées) | ☐ |
| 5.2 | Boutons **‹** / **›** autour de la date | Jour précédent / suivant ; bouton **Aujourd'hui** pour revenir | ☐ |
| 5.3 | Pastilles **À faire / En cours / Terminées** | Filtre la liste | ☐ |
| 5.4 | **Démarrer le ménage** (bouton pleine largeur) | Statut En cours, mon nom affiché, bordure bleue à gauche ; chambre « En nettoyage » côté réception | ☐ |
| 5.5 | Avec 0341000003, essayer de terminer la tâche de la collègue | Refusé | ☐ |
| 5.6 | **Terminer : chambre propre** → quantités (clavier numérique sur téléphone) → **Valider** | Chambre **Propre** à la réception ; stock diminué des articles déclarés | ☐ |
| 5.7 | Quantité `-1` | Erreur sous le champ | ☐ |

## 6. Restaurant (0341000004) — tester sur tablette (768 px)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 6.1 | **Prise de commande** : **+ Ajouter** plusieurs fois un plat | Pastille verte avec la quantité sur le bouton ; titre « Panier (N) » | ☐ |
| 6.2 | Boutons **−** / **+** du panier (40 px) | Quantité modifiée ; à 0 la ligne disparaît | ☐ |
| 6.3 | Sur place + table 5 → **Envoyer** | Message vert avec la référence et lien « Voir le suivi » | ☐ |
| 6.4 | **Suivi** : Lancer la préparation → Marquer prête → Marquer remise | Le badge suit chaque étape ; la liste se rafraîchit seule toutes les 15 s | ☐ |
| 6.5 | **Annuler** une commande reçue | Fenêtre de confirmation rouge (nombre de plats, montant) avant l'annulation | ☐ |
| 6.6 | **Imputer à une chambre** occupée | Montant ajouté à la facture du client (voir 3.8) | ☐ |
| 6.7 | Imputer à une chambre **libre** | Message « Aucun séjour en cours dans la chambre … » | ☐ |
| 6.8 | **Facturer et encaisser** | Facture restaurant + encaissement espèces | ☐ |
| 6.9 | **Menus et plats** : créer un menu, un plat, changer un prix, **Marquer épuisé** | Le plat épuisé disparaît de la prise de commande et de l'accueil | ☐ |

## 7. Communication (0341000006)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 7.1 | **Publier** un menu | Visible sur la page d'accueil | ☐ |
| 7.2 | **Dépublier** | Disparaît de l'accueil | ☐ |
| 7.3 | **Texte Facebook** → **Copier** | « Copié ! » ; le texte se colle dans un éditeur | ☐ |

## 8. Comptable (0341000005)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 8.1 | **Copies de factures** | Factures clôturées avec part hébergement / restaurant | ☐ |
| 8.2 | **Reversements** → **Marquer reversé** | Statut **Reversé** | ☐ |
| 8.3 | **Tableaux journaliers** → **Générer** pour aujourd'hui | Nuitées, canaux, CA, contrôle du stock avec écart | ☐ |
| 8.4 | **Stock** → **Mouvement** d'entrée de 50 | Quantité +50 ; visible dans **Historique** | ☐ |
| 8.5 | Sortie qui ferait passer le stock sous 0 | Refusée | ☐ |
| 8.6 | Article sous son seuil | Affiché en rouge « Stock bas » | ☐ |

## 9. Administrateur (0340000001)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 9.1 | **Comptes** : créer un réceptionniste | Il peut se connecter | ☐ |
| 9.2 | **Désactiver** ce compte | Il est déconnecté et ne peut plus se connecter | ☐ |
| 9.3 | **Catégories** : créer une catégorie | Visible à l'accueil, avec le nombre de chambres | ☐ |
| 9.4 | **Chambres** : créer une chambre | Disponible pour les réservations de sa catégorie | ☐ |
| 9.5 | **Articles** : créer un article | Visible dans le stock | ☐ |

## 10. Robustesse (règles métier critiques)

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 10.1 | Deux fenêtres réservent la **dernière** chambre d'une catégorie aux mêmes dates en même temps | Une seule réussit ; l'autre reçoit « Aucune chambre disponible » (contrainte `EXCLUDE`) | ☐ |
| 10.2 | Couper un service : `Ctrl+C` sur le terminal 1, puis recharger une page | Message « Service momentanément indisponible », pas de page blanche | ☐ |
| 10.3 | Arrêter Redis (`docker compose stop redis`), terminer un ménage, relancer Redis | L'événement part quand Redis revient (outbox) : la chambre repasse Propre | ☐ |
| 10.4 | Rejouer une notification Papi (même requête deux fois) | Un seul paiement enregistré (idempotence) | ☐ |

## 11. Accessibilité et performance

| # | Action | Résultat attendu | OK |
|---|---|---|---|
| 11.1 | Lighthouse (F12 → Lighthouse → Accessibility) sur Accueil, Réservations, Tâches | Score ≥ 90 ; noter le score de chaque page | ☐ |
| 11.2 | Zoom navigateur à 200 % | Aucun texte coupé, aucun défilement horizontal de la page | ☐ |
| 11.3 | Lecteur d'écran (NVDA sous Windows) sur la confirmation de check-out | Le titre de la fenêtre est lu à l'ouverture | ☐ |
