-- Extension nécessaire pour combiner "=" (uuid) et "&&" (daterange) dans une contrainte EXCLUDE
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Anti-surbooking : une chambre ne peut pas avoir deux réservations actives qui se chevauchent.
-- '[)' : la date de départ est exclue, donc un départ le 13 et une arrivée le 13 ne se chevauchent pas.
ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_sans_chevauchement"
  EXCLUDE USING gist (
    "chambre_id" WITH =,
    daterange("date_arrivee", "date_depart", '[)') WITH &&
  )
  WHERE ("statut" IN ('EN_ATTENTE_PAIEMENT', 'CONFIRMEE', 'EN_COURS'));

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_dates_coherentes" CHECK ("date_depart" > "date_arrivee");

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_montant_positif" CHECK ("montant_total" >= 0);

ALTER TABLE "categorie_chambre"
  ADD CONSTRAINT "categorie_chambre_tarif_positif" CHECK ("tarif_nuit" > 0);

ALTER TABLE "categorie_chambre"
  ADD CONSTRAINT "categorie_chambre_capacite_positive" CHECK ("capacite" > 0);

-- Deux saisons ne peuvent pas se chevaucher. '[]' : date_debut et date_fin sont incluses.
ALTER TABLE "saison"
  ADD CONSTRAINT "saison_sans_chevauchement"
  EXCLUDE USING gist (
    daterange("date_debut", "date_fin", '[]') WITH &&
  );
