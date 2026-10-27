---
"@hotel/facturation": patch
---

Paiement reçu sur un lien remplacé alors que la facture n'est pas soldée : il est accepté et le nouveau lien est abandonné, au lieu d'être classé en ANOMALIE (le client ne perd plus sa chambre). Un lien abandonné payé ensuite reste une ANOMALIE.
