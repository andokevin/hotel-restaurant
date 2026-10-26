# Audit UX v1 — 10 heuristiques de Nielsen

Date : 26/10/2026 · Version auditée : `main` après #9 (refonte v1.1 incluse) · Issue : #10

## Méthode

- **Revue experte** (évaluation heuristique) : pour chaque groupe d'écrans, une **tâche réelle** est suivie pas à pas
  dans l'interface (ce que l'utilisateur voit, peut faire, et ce qui se passe en cas d'erreur), sur ordinateur et au
  téléphone (360 px), en lisant le code des écrans et en vérifiant dans les services les comportements qui en dépendent.
- **Limites** : ce n'est pas un test avec de vrais utilisateurs, ni une mesure Lighthouse. Les scores Lighthouse
  « Accessibilité », les captures d'écran et le test avec 3 à 5 personnes sont faits dans **#11**.
- Heuristiques : H1 visibilité de l'état · H2 correspondance avec le monde réel · H3 contrôle et liberté ·
  H4 cohérence et standards · H5 prévention des erreurs · H6 reconnaître plutôt que se souvenir ·
  H7 flexibilité et efficacité · H8 esthétique et minimalisme · H9 aider à reconnaître et corriger les erreurs ·
  H10 aide et documentation.
- Gravité : **0** pas un problème · **1** cosmétique · **2** mineur · **3** majeur (→ issue) · **4** catastrophe (→ issue prioritaire).

---

## 1. Accueil + Réserver (téléphone)

**Tâche :** « Trouver une chambre pour 2 personnes le week-end prochain et la réserver » (visiteur sans compte, puis client).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 1.1 | Réserver | les deux | Le formulaire ne demande **pas le nombre de personnes** ; la capacité n'apparaît que dans le texte de l'option (« (2 pers.) »). Rien n'empêche de réserver une chambre pour 2 à 5. | H2, H5 | **3** | Champs adultes / enfants, catégories filtrées selon la capacité, refus serveur au-delà | #74 |
| 1.2 | Connexion → Créer un compte | les deux | Un **nouveau visiteur** clique « Réserver cette chambre », arrive sur la connexion, n'a pas de compte et clique « Créer un compte » : la destination mémorisée est **perdue** ; après l'inscription il arrive sur « Réserver » **sans** la catégorie choisie (#8 ne marche que pour les clients qui ont déjà un compte). | H3, H6 | **3** | Transmettre `state.depuis` de la connexion à l'inscription, et rediriger l'inscription vers `depuis` | **#81** |
| 1.3 | Réserver | les deux | La **disponibilité** n'est connue qu'à l'envoi, après avoir rempli la pièce d'identité : « Aucune chambre disponible » arrive en dernier. | H1, H5 | **3** | Calendrier / vérification de disponibilité avant les coordonnées | #53 |
| 1.4 | Réserver | les deux | L'**estimation** utilise le tarif de base (`nuits × tarifNuit`) et ignore les saisons : elle peut différer du montant réel affiché ensuite. | H1, H9 | 2 | Demander l'estimation au serveur (calcul avec les saisons), ou afficher « à partir de » | #52 |
| 1.5 | Réserver | les deux | Le champ **Départ** accepte une date antérieure à l'arrivée (`min` = aujourd'hui) ; l'erreur n'apparaît qu'à l'envoi. Changer l'arrivée ne décale pas le départ. | H5 | 2 | `min` du départ = arrivée + 1 ; décaler automatiquement le départ | #52 |
| 1.6 | Réserver | téléphone | Choix de la catégorie dans une **liste déroulante** native au texte long (« Suite senior — 165 000 Ar / nuit (3 pers.) »), sans photo ni description : il faut se souvenir de l'accueil. | H6, H8 | 2 | Cartes de catégories sélectionnables (maquette Stitch 04) | #52, #50 |
| 1.7 | Réserver | les deux | La **pièce d'identité** est redemandée à chaque réservation. | H7 | 1 | La mémoriser dans le profil (avec consentement) | — |
| 1.8 | Accueil | téléphone | Pour un visiteur, l'onglet du bas « **Réservations** » mène au formulaire de réservation, pas à une liste : libellé trompeur. | H4 | 1 | « Réserver » pour un visiteur, « Mes réservations » pour un client | — |
| 1.9 | Accueil | les deux | Pas de **photos** de chambres (illustration à la place). | H2 | 1 | Photos par catégorie | #50 |

## 2. Mes réservations + Résultat du paiement (téléphone)

**Tâche :** « Payer une réservation en attente, puis vérifier qu'elle est confirmée » (avec un succès, puis un échec `0341230002`).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 2.1 | Résultat du paiement | les deux | Après un **échec**, le message dit « Vous pouvez réessayer depuis vos réservations », mais **aucun bouton** ne permet de réessayer : il faut retrouver la réservation soi-même. | H3, H9 | **3** | Bouton « Réessayer le paiement » (nouveau lien) et bouton « Mes réservations » | **#82** |
| 2.2 | Résultat du paiement | les deux | Après 60 s sans confirmation : « consultez vos réservations dans quelques minutes », avec un simple lien « ← Retour ». | H1, H3 | 2 | Bouton « Voir mes réservations » ; la liste se rafraîchit déjà seule | #82 |
| 2.3 | Mes réservations | les deux | Réservations **à venir, passées et annulées mélangées**, triées par date d'arrivée ; la réservation utile se perd vite. | H6, H8 | 2 | Onglets « À venir / Passées » (maquette Stitch 07) | — |
| 2.4 | Mes réservations | les deux | Le client **ne peut pas annuler** sa réservation lui-même. | H3 | 2 | Annulation selon la politique de l'hôtel | #76 |
| 2.5 | Mes réservations | les deux | Délai dépassé : « Délai de paiement dépassé », mais le bouton **Payer** reste affiché jusqu'au rafraîchissement de la liste (le serveur refuse ensuite avec un message clair). | H1 | 1 | Masquer « Payer » quand le délai est écoulé | — |
| 2.6 | Mes réservations | les deux | Le bouton « Nouvelle réservation » a un style propre, différent des autres boutons d'action (`classeBouton`). | H4 | 1 | Utiliser `classeBouton("accent")` | — |

## 3. Ménage (téléphone)

**Tâche :** « Faire le ménage d'une chambre de départ, de bout en bout » (femme de ménage).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 3.1 | Tâches du jour | téléphone | « Démarrer le ménage » appuyé **sur la mauvaise chambre** ne peut pas être annulé (aucun retour à « À faire »). | H3 | 2 | Action « Abandonner » (retour à À faire) pendant quelques minutes | — |
| 3.2 | Tâches du jour | téléphone | Si une collègue a déjà pris la tâche, l'erreur s'affiche **en haut de la page**, loin de la carte touchée : hors de l'écran après défilement. | H9, H1 | 2 | Afficher l'erreur dans la carte concernée et rafraîchir la liste | — |
| 3.3 | Tâches du jour | téléphone | Aucune **heure limite** (chambre à préparer avant l'arrivée suivante). | H1 | 2 | Heures prévues et alerte de retard | #54 |
| 3.4 | Terminer le ménage | téléphone | Quantités saisies au **clavier** (champs numériques) ; des boutons − / + seraient plus rapides d'une main. | H7 | 1 | Compteurs − / + (maquette Stitch 16) | — |
| 3.5 | Tâches du jour | ordinateur | Pour la **réception**, l'écran est en lecture seule sans le dire (aucun bouton, aucune explication). | H1 | 1 | Bandeau « Consultation : seules les femmes de ménage démarrent une tâche » | — |

## 4. Prise de commande + Suivi (tablette)

**Tâche :** « Prendre la commande de la table 5, puis la suivre jusqu'à la remise » (restaurant).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 4.1 | Suivi des commandes | tablette | Commandes **remises et annulées mêlées** aux commandes à préparer (filtre par défaut « Tous les statuts ») : au fil de la journée, la cuisine cherche les commandes actives parmi l'historique. | H8, H6 | **3** | Vue par défaut « en cours » (Reçues, En préparation, Prêtes), colonnes par étape (maquette Stitch 18) | **#83** |
| 4.2 | Suivi des commandes | tablette | Pas de **temps écoulé** depuis la commande : impossible de voir une table qui attend depuis 30 min. | H1 | 2 | « il y a 12 min », en couleur au-delà de 15 min | #83 |
| 4.3 | Prise de commande | tablette | Une commande **sur place** peut être envoyée **sans numéro de table** : le serveur ne sait pas où servir. | H5 | 2 | Table obligatoire pour « Sur place » | — |
| 4.4 | Prise de commande | tablette | Plats listés par menu, **sans onglets par catégorie** ni recherche : beaucoup de défilement. | H7 | 2 | Onglets Entrées / Plats / Desserts / Boissons | — |
| 4.5 | Suivi des commandes | tablette | « Imputer à une chambre » : numéro de chambre **à taper de mémoire** ; l'erreur n'arrive qu'après. | H6, H5 | 2 | Liste des chambres occupées (numéro + nom du client) | — |
| 4.6 | Suivi des commandes | tablette | « Facturer et encaisser » crée la facture **sans confirmation** : un appui par erreur empêche d'imputer la commande à la chambre. | H5 | 2 | Confirmation, ou création de la facture au moment de l'encaissement | — |
| 4.7 | Suivi des commandes | tablette | Deux pastilles côte à côte (préparation et paiement) **sans libellé** de rôle. | H2 | 1 | « Cuisine : … · Paiement : … » | — |

## 5. Factures + Départs (ordinateur)

**Tâche :** « Faire partir un client : encaisser le reste et clôturer sa facture » (réception).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 5.1 | Factures (détail) | ordinateur | « **Clôturer la facture** » est proposé dès qu'une facture de séjour est payée, **même si le client est encore à l'hôtel**, et **sans confirmation**. Ensuite, un repas imputé à sa chambre est **ignoré en silence** (`facture.service.ts`, consommation reçue après la clôture : simple message dans les journaux) alors que le restaurant le croit imputé : **le repas n'est jamais payé**. | H5, H1 | **4** | Interdire la clôture manuelle d'une facture de séjour avant le check-out (règle serveur) ; confirmation ; refuser l'imputation côté restaurant si la facture est close | **#84** |
| 5.2 | Départs du jour | ordinateur | L'**état de la facture n'est pas affiché** : le texte demande d'aller vérifier dans l'écran Factures avant le check-out. Il faut se souvenir et changer d'écran pour chaque départ. | H6, H5 | **3** | Colonne « Reste à payer », bouton « Encaisser » et lien vers la facture sur chaque ligne | **#85** |
| 5.3 | Factures | ordinateur | Pas de **recherche** (client, numéro, chambre), seulement un filtre par statut. | H7 | 2 | Recherche et filtres | #55 |
| 5.4 | Factures | ordinateur | La liste n'indique ni la **chambre** ni la **réservation** liées. | H6 | 1 | Colonnes chambre / référence | #55 |

## 6. Tableaux + Reversements (ordinateur)

**Tâche :** « Vérifier la journée d'hier, puis reverser au restaurant ce qui lui revient » (comptable).

| # | Écran | Appareil | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|---|---|
| 6.1 | Tableaux | ordinateur | Le contrôle du stock affiche les **codes techniques** (`GEL_DOUCHE`) au lieu des libellés. | H2 | 2 | Afficher le libellé de l'article | — |
| 6.2 | Reversements | ordinateur | « **Marquer reversé** » sans confirmation (action financière définitive) et bouton **petit** (classes anciennes `px-2 py-1 text-xs`, cible tactile < 44 px). | H5, H4 | 2 | Confirmation ; `taille="petit"` du composant Bouton | — |
| 6.3 | Tableaux | ordinateur | Aucun **graphique** ni comparaison avec la période précédente. | H7 | 2 | Tableau de bord interactif | #61 |
| 6.4 | Reversements | ordinateur | Seul le **numéro de facture** est affiché : ni date, ni client, ni commandes concernées. | H6 | 1 | Date, client et détail de la facture | — |

## 7. Transversal

| # | Problème observé | Heuristique | Gravité | Correction proposée | Suivi |
|---|---|---|---|---|---|
| 7.1 | Aucune **aide** intégrée (premiers pas par rôle, explication des statuts). | H10 | 2 | Page d'aide par rôle, infobulles sur les statuts | — |
| 7.2 | Retour après action **inégal** : certaines actions affichent « … enregistré », d'autres rien (Marquer reversé, démarrer un ménage). | H1, H4 | 1 | Notification courte (toast) commune à toutes les actions | — |
| 7.3 | Interface en **français uniquement**. | H2 | 2 | Français / anglais / malgache | #34 |

---

## Synthèse

| Gravité | Nombre | Problèmes | Issues |
|---|---|---|---|
| **4** | 1 | 5.1 | #84 (nouvelle) |
| **3** | 6 | 1.1, 1.2, 1.3, 2.1, 4.1, 5.2 | #74, #53 (existantes) ; #81, #82, #83, #85 (nouvelles) |
| 2 | 20 | | rattachés aux issues existantes quand elles couvrent le sujet (#50, #52, #54, #55, #61, #76, #34), sinon à traiter lors de la refonte de l'écran |
| 1 | 11 | | à traiter lors de la refonte de l'écran |
| **Total** | **38** | | |

**Priorités :**
1. **#84** (gravité 4, perte d'argent) avant toute autre amélioration d'interface.
2. Les gravités 3 de la Phase 0 : #74, #81, #82, #85, puis #83.
3. Les gravités 2 et 1 alimentent les maquettes Stitch / Figma (phase B) écran par écran.

**À compléter dans #11 :** scores Lighthouse « Accessibilité » par écran (ordinateur et téléphone), captures d'écran des
problèmes de gravité ≥ 3, et test avec 3 à 5 utilisateurs réels.
