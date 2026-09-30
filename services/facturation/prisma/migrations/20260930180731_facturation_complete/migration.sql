-- Générée par prisma migrate diff, puis complétée à la main (fin du fichier).

-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('FR', 'MG', 'EN');

-- AlterEnum
BEGIN;
CREATE TYPE "MethodePaiement_new" AS ENUM ('ESPECES', 'MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'CARTE');
ALTER TABLE "paiement" ALTER COLUMN "methode" TYPE "MethodePaiement_new" USING ("methode"::text::"MethodePaiement_new");
ALTER TYPE "MethodePaiement" RENAME TO "MethodePaiement_old";
ALTER TYPE "MethodePaiement_new" RENAME TO "MethodePaiement";
DROP TYPE "public"."MethodePaiement_old";
COMMIT;

-- AlterEnum
ALTER TYPE "StatutFacture" ADD VALUE 'CLOTUREE';

-- AlterEnum
ALTER TYPE "StatutPaiement" ADD VALUE 'ANOMALIE';

-- AlterTable
ALTER TABLE "facture" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "client_telephone" TEXT,
ADD COLUMN     "cloturee_le" TIMESTAMPTZ,
ADD COLUMN     "commande_id" UUID,
ADD COLUMN     "emise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "langue" "Langue" NOT NULL DEFAULT 'FR';

-- AlterTable
ALTER TABLE "paiement" ADD COLUMN     "encaisse_par" UUID,
ADD COLUMN     "notification_token_hash" TEXT,
ALTER COLUMN "jeton_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "outbox_evenement" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publie_le" TIMESTAMPTZ,

    CONSTRAINT "outbox_evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenement_traite" (
    "evenement_id" UUID NOT NULL,
    "traite_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenement_traite_pkey" PRIMARY KEY ("evenement_id")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "facture_commande_id_key" ON "facture"("commande_id");

-- CreateIndex
CREATE INDEX "facture_client_id_idx" ON "facture"("client_id");

-- CreateIndex
CREATE INDEX "facture_statut_idx" ON "facture"("statut");


-- ---------------------------------------------------------------------------
-- Ajouts manuels : ce que schema.prisma ne sait pas exprimer
-- ---------------------------------------------------------------------------

-- Règles du modèle de données (la base est le dernier rempart)
ALTER TABLE "facture" ADD CONSTRAINT "facture_montants_positifs" CHECK ("montant_total" >= 0 AND "montant_paye" >= 0);
-- On ne peut jamais encaisser plus que le total : un surpaiement est refusé par la base elle-même.
ALTER TABLE "facture" ADD CONSTRAINT "facture_pas_de_surpaiement" CHECK ("montant_paye" <= "montant_total");
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_quantite_positive" CHECK ("quantite" > 0);
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_montant_positif" CHECK ("prix_unitaire" >= 0 AND "montant" >= 0);
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_montant_positif" CHECK ("montant" > 0);

-- Au plus UN paiement en attente par facture : deux clics simultanés sur « Payer »
-- ne peuvent pas créer deux liens Papi (le second INSERT est refusé, on renvoie le premier).
CREATE UNIQUE INDEX "paiement_un_en_attente_par_facture" ON "paiement" ("facture_id") WHERE "statut" = 'EN_ATTENTE';
