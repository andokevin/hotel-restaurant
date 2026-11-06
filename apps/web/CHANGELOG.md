# @hotel/web

## 1.1.0

### Minor Changes

- afe1a2e: Écran « Anomalies de paiement » (comptable, admin) : chaque anomalie avec sa situation (à rembourser / à accepter), la référence Papi, le client et tous les paiements de la facture. Boutons « Marquer remboursé » et « Accepter ce paiement », avec confirmation et commentaire obligatoire. Le menu affiche le nombre d'anomalies à traiter.
- 4c3b4ae: Réservation : champs « Adultes » et « Enfants » ; seules les catégories assez grandes sont proposées (`GET /categories?personnes=`), un refus de capacité s'affiche sous ces champs. Le nombre de personnes apparaît dans le récapitulatif, la liste de la réception, le check-in et les départs.
- 8100090: Refonte UX/UI (v1.1) : jetons de design (émeraude, sable, terre cuite), boutons et champs de 44 px,
  modale accessible (Échap, focus, feuille en bas sur téléphone), confirmation avant check-out et annulations
  (fin de window.confirm), recherche et vues « Arrivées / Départs du jour » à la réception, tâches de ménage
  triées avec navigation par jour, panier du restaurant plus lisible, nouvelle page d'accueil.

### Patch Changes

- e7c795e: Clôture d'une facture de séjour : refusée tant que le client n'est pas parti (les repas imputés à la chambre étaient perdus) ; confirmation demandée avant toute clôture.
- 09d7817: Départs du jour : colonne « Reste à payer » (en rouge s'il reste de l'argent, « Soldée » sinon), bouton « Encaisser » qui ouvre la facture du séjour sur place, et avertissement dans la confirmation du check-out si le séjour n'est pas soldé.
- 5d49e6c: Détail d'une facture : toutes les lignes, dans l'ordre du séjour (groupes de nuitées), puis les consommations ; quantité × prix unitaire sous chaque libellé et saison mise en évidence. Présentation en liste, lisible sur un téléphone de 360 px.
- d29ca27: Inscription depuis une chambre choisie : la catégorie n'est plus perdue. « Créer un compte » (et « Se connecter » depuis l'inscription) transmet la page de provenance, et l'inscription y ramène le client. Seuls les chemins internes sont acceptés (pas de redirection vers un autre site). Mise en place des tests du front (Vitest, Testing Library, jsdom).
- 08abb2c: Résultat du paiement : après un échec, bouton « Réessayer le paiement » (nouveau lien Papi pour la même facture, seulement si elle attend encore de l'argent) et lien « Mes réservations » ; après 60 s sans confirmation, bouton « Voir mes réservations ».
- a639582: Résultat du paiement : la page signale au serveur que le client revient de Papi avant de lire le statut. « Réessayer » ouvre donc toujours une nouvelle page Papi, même dans les 30 s. Une erreur de ce signalement n'empêche pas d'afficher le résultat.
- 2912cac: Réserver depuis l'accueil : après connexion, le client revient sur le formulaire avec la catégorie choisie déjà sélectionnée
- ebb1eb5: Suivi des commandes : vue par défaut « En cours » pour la cuisine, en colonnes Reçues / En préparation / Prêtes (la plus ancienne en premier) ; chaque commande affiche son temps d'attente, mis à jour sans recharger, et est signalée « En retard » au-delà de 15 min. L'historique (remises, annulées, toutes) reste accessible par le filtre.
