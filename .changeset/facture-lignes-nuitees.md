---
"@hotel/commun": minor
"@hotel/hebergement": minor
"@hotel/facturation": minor
---

Facture de séjour : une ligne par groupe de nuits consécutives au même tarif (la saison est nommée), au lieu d'une ligne unique. `reservation.creee` transporte les nuitées (champ facultatif : un ancien événement donne toujours une seule ligne). Les chemins événement et REST utilisent le même calcul.
