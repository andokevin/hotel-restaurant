---
"@hotel/facturation": minor
"@hotel/api-gateway": minor
---

Anomalies de paiement : `GET /paiements/anomalies` (comptable, admin) liste l'argent débité mais non compté, avec la facture, tous ses paiements, la référence Papi et la situation calculée (à rembourser / à accepter). `POST /paiements/:id/rembourse` et `POST /paiements/:id/accepter` traitent l'anomalie, avec un commentaire obligatoire et une trace (qui, quand). Nouveau statut `REMBOURSE`.
