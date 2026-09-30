-- CreateEnum
CREATE TYPE "TypeFacture" AS ENUM ('RESTAURANT');

-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('EMISE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "Origine" AS ENUM ('HEBERGEMENT', 'RESTAURANT', 'LIVRAISON');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'REUSSI', 'ECHOUE');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('AIRTEL_MONEY', 'ORANGE_MONEY', 'CARTE', 'AUTRE');

-- CreateTable
CREATE TABLE "facture" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeFacture" NOT NULL,
    "reservation_id" UUID,
    "client_nom" TEXT NOT NULL,
    "client_email" TEXT,
    "statut" "StatutFacture" NOT NULL DEFAULT 'EMISE',
    "montant_total" INTEGER NOT NULL,
    "montant_paye" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ligne_facture" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "origine" "Origine" NOT NULL,
    "source_id" UUID NOT NULL,

    CONSTRAINT "ligne_facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiement" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "montant" INTEGER NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "methode" "MethodePaiement",
    "reference_externe" TEXT,
    "jeton_hash" TEXT NOT NULL,
    "url_paiement" TEXT,
    "erreur" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteur_facture" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL,

    CONSTRAINT "compteur_facture_pkey" PRIMARY KEY ("annee")
);

-- CreateIndex
CREATE UNIQUE INDEX "facture_numero_key" ON "facture"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "facture_reservation_id_key" ON "facture"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ligne_facture_origine_source_id_key" ON "ligne_facture"("origine", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "paiement_reference_externe_key" ON "paiement"("reference_externe");

-- CreateIndex
CREATE INDEX "paiement_facture_id_idx" ON "paiement"("facture_id");

-- AddForeignKey
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "facture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
