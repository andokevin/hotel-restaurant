# @hotel/facturation

## 1.1.0

### Minor Changes

- a65ca00: Anomalies de paiement : `GET /paiements/anomalies` (comptable, admin) liste l'argent débité mais non compté, avec la facture, tous ses paiements, la référence Papi et la situation calculée (à rembourser / à accepter). `POST /paiements/:id/rembourse` et `POST /paiements/:id/accepter` traitent l'anomalie, avec un commentaire obligatoire et une trace (qui, quand). Nouveau statut `REMBOURSE`.
- 5bb7ed9: Facture de séjour : une ligne par groupe de nuits consécutives au même tarif (la saison est nommée), au lieu d'une ligne unique. `reservation.creee` transporte les nuitées (champ facultatif : un ancien événement donne toujours une seule ligne). Les chemins événement et REST utilisent le même calcul.
- b0e28a7: Paiement : `POST /paiements/:id/retour` marque un lien Papi comme visité (le client est revenu de Papi). Un lien visité n'est plus jamais réutilisé, même dans les 30 s : le client qui échoue sur Papi et réessaie aussitôt reçoit un nouveau lien. Le retour ne change jamais le statut du paiement.

### Patch Changes

- 6d80443: Paiement en ANOMALIE : la référence Papi, le moyen de paiement et le montant réellement reçu (nouvelle colonne `montant_recu`) sont enregistrés, pour pouvoir retrouver et rembourser la transaction.
- e7c795e: Clôture d'une facture de séjour : refusée tant que le client n'est pas parti (les repas imputés à la chambre étaient perdus) ; confirmation demandée avant toute clôture.
- d195d1a: Événements validés avec Zod dès l'écriture dans l'outbox : un contenu contraire au contrat lève une erreur et annule la transaction métier, au lieu d'être rejeté plus tard par le consommateur.
- 113ea12: Paiement Papi : un lien en attente n'est réutilisé que pendant 30 s (double clic) ; au-delà, il est remplacé par un nouveau lien, car il a pu être consommé sur Papi.
- 1b1077d: Réservation : nombre d'adultes et d'enfants (1 et 0 par défaut), refus 422 si la catégorie est trop petite, filtre `GET /categories?personnes=`. L'événement `reservation.creee` transporte `nbAdultes` et `nbEnfants` ; les consommateurs reçoivent désormais le contenu parsé (valeurs par défaut appliquées aux anciens événements).
- 64a1b16: Paiement reçu sur un lien remplacé alors que la facture n'est pas soldée : il est accepté et le nouveau lien est abandonné, au lieu d'être classé en ANOMALIE (le client ne perd plus sa chambre). Un lien abandonné payé ensuite reste une ANOMALIE.
- Updated dependencies [d195d1a]
- Updated dependencies [5bb7ed9]
- Updated dependencies [b19ab25]
- Updated dependencies [1b1077d]
  - @hotel/commun@1.1.0
