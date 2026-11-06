-- Facture de séjour : une ligne par groupe de nuitées (#73).
-- Une réservation peut maintenant avoir plusieurs lignes d'hébergement : l'unicité
-- (origine, source_id) devient (origine, source_id, ordre). Les lignes existantes ont l'ordre 0.
ALTER TABLE "ligne_facture" ADD COLUMN "ordre" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "ligne_facture_origine_source_id_key";

CREATE UNIQUE INDEX "ligne_facture_origine_source_id_ordre_key" ON "ligne_facture"("origine", "source_id", "ordre");

-- Écrit à la main : Prisma ne sait pas générer de CHECK.
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_ordre_positif" CHECK ("ordre" >= 0);
