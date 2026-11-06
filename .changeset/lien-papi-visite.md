---
"@hotel/facturation": minor
"@hotel/api-gateway": minor
---

Paiement : `POST /paiements/:id/retour` marque un lien Papi comme visité (le client est revenu de Papi). Un lien visité n'est plus jamais réutilisé, même dans les 30 s : le client qui échoue sur Papi et réessaie aussitôt reçoit un nouveau lien. Le retour ne change jamais le statut du paiement.
