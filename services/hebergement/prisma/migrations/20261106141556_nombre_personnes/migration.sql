-- Nombre de personnes de la réservation (#74).
-- Les réservations existantes reçoivent 1 adulte et 0 enfant.
ALTER TABLE "reservation"
  ADD COLUMN "nb_adultes" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "nb_enfants" INTEGER NOT NULL DEFAULT 0;

-- Écrits à la main : Prisma ne sait pas générer de CHECK.
ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_nb_adultes_min" CHECK ("nb_adultes" >= 1);

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_nb_enfants_min" CHECK ("nb_enfants" >= 0);
