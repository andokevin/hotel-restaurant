# @hotel/api-gateway

## 1.1.0

### Minor Changes

- a65ca00: Anomalies de paiement : `GET /paiements/anomalies` (comptable, admin) liste l'argent débité mais non compté, avec la facture, tous ses paiements, la référence Papi et la situation calculée (à rembourser / à accepter). `POST /paiements/:id/rembourse` et `POST /paiements/:id/accepter` traitent l'anomalie, avec un commentaire obligatoire et une trace (qui, quand). Nouveau statut `REMBOURSE`.
- b0e28a7: Paiement : `POST /paiements/:id/retour` marque un lien Papi comme visité (le client est revenu de Papi). Un lien visité n'est plus jamais réutilisé, même dans les 30 s : le client qui échoue sur Papi et réessaie aussitôt reçoit un nouveau lien. Le retour ne change jamais le statut du paiement.

### Patch Changes

- Updated dependencies [d195d1a]
- Updated dependencies [5bb7ed9]
- Updated dependencies [b19ab25]
- Updated dependencies [1b1077d]
  - @hotel/commun@1.1.0
