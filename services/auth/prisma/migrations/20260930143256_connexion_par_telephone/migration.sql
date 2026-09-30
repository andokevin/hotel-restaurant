-- Alignement sur docs/modele-donnees.md : le téléphone devient l'identifiant de connexion principal.
-- Écrite à la main : Prisma proposait DROP COLUMN "nom_complet" + ADD COLUMN "nom",
-- ce qui aurait effacé le nom de tous les comptes existants. Un RENAME garde les données.

CREATE TYPE "Langue" AS ENUM ('FR', 'MG', 'EN');

ALTER TABLE "utilisateur" RENAME COLUMN "nom_complet" TO "nom";

ALTER TABLE "utilisateur" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "utilisateur" ADD COLUMN "langue" "Langue" NOT NULL DEFAULT 'FR';

-- Pas de valeur par défaut possible pour un numéro de téléphone : sur une base qui contient
-- déjà des comptes, cette ligne ÉCHOUE volontairement (« contains null values ») plutôt que
-- d'inventer des numéros. Il faudrait alors ajouter la colonne en nullable, faire saisir les
-- numéros, puis la passer en NOT NULL dans une seconde migration.
ALTER TABLE "utilisateur" ADD COLUMN "telephone" TEXT NOT NULL;

CREATE UNIQUE INDEX "utilisateur_telephone_key" ON "utilisateur"("telephone");
