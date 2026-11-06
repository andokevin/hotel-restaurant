---
"@hotel/hebergement": minor
"@hotel/commun": minor
"@hotel/facturation": patch
---

Réservation : nombre d'adultes et d'enfants (1 et 0 par défaut), refus 422 si la catégorie est trop petite, filtre `GET /categories?personnes=`. L'événement `reservation.creee` transporte `nbAdultes` et `nbEnfants` ; les consommateurs reçoivent désormais le contenu parsé (valeurs par défaut appliquées aux anciens événements).
