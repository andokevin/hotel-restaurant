---
"@hotel/web": patch
---

Résultat du paiement : la page signale au serveur que le client revient de Papi avant de lire le statut. « Réessayer » ouvre donc toujours une nouvelle page Papi, même dans les 30 s. Une erreur de ce signalement n'empêche pas d'afficher le résultat.
