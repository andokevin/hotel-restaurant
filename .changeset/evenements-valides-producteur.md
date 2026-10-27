---
"@hotel/commun": patch
"@hotel/hebergement": patch
"@hotel/facturation": patch
"@hotel/menage": patch
"@hotel/stock": patch
"@hotel/restaurant": patch
"@hotel/comptabilite": patch
---

Événements validés avec Zod dès l'écriture dans l'outbox : un contenu contraire au contrat lève une erreur et annule la transaction métier, au lieu d'être rejeté plus tard par le consommateur.
