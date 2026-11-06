# @hotel/hebergement

## 1.1.0

### Minor Changes

- 5bb7ed9: Facture de séjour : une ligne par groupe de nuits consécutives au même tarif (la saison est nommée), au lieu d'une ligne unique. `reservation.creee` transporte les nuitées (champ facultatif : un ancien événement donne toujours une seule ligne). Les chemins événement et REST utilisent le même calcul.
- 1b1077d: Réservation : nombre d'adultes et d'enfants (1 et 0 par défaut), refus 422 si la catégorie est trop petite, filtre `GET /categories?personnes=`. L'événement `reservation.creee` transporte `nbAdultes` et `nbEnfants` ; les consommateurs reçoivent désormais le contenu parsé (valeurs par défaut appliquées aux anciens événements).

### Patch Changes

- d195d1a: Événements validés avec Zod dès l'écriture dans l'outbox : un contenu contraire au contrat lève une erreur et annule la transaction métier, au lieu d'être rejeté plus tard par le consommateur.
- b19ab25: Réservation : le téléphone est normalisé comme à l'inscription ("034 12 345 67" et "+261…" acceptés, stockés "0341234567"). La règle est partagée dans @hotel/commun
- Updated dependencies [d195d1a]
- Updated dependencies [5bb7ed9]
- Updated dependencies [b19ab25]
- Updated dependencies [1b1077d]
  - @hotel/commun@1.1.0
