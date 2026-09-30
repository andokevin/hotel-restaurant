-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatutReversement" AS ENUM ('A_REVERSER', 'REVERSE');

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

-- CreateTable
CREATE TABLE "copie_facture" (
    "facture_id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "client_nom" TEXT NOT NULL,
    "montant_total" INTEGER NOT NULL,
    "montant_hebergement" INTEGER NOT NULL,
    "montant_restaurant" INTEGER NOT NULL,
    "cloturee_le" TIMESTAMPTZ NOT NULL,
    "lignes" JSONB NOT NULL,
    "recue_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copie_facture_pkey" PRIMARY KEY ("facture_id")
);

-- CreateTable
CREATE TABLE "statistique_journaliere" (
    "jour" DATE NOT NULL,
    "nuitees_vendues" INTEGER NOT NULL,
    "nombre_factures" INTEGER NOT NULL,
    "ca_hebergement" INTEGER NOT NULL,
    "ca_restaurant" INTEGER NOT NULL,
    "ca_livraison" INTEGER NOT NULL DEFAULT 0,
    "repartition_canaux" JSONB NOT NULL,
    "genere_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statistique_journaliere_pkey" PRIMARY KEY ("jour")
);

-- CreateTable
CREATE TABLE "controle_stock_journalier" (
    "jour" DATE NOT NULL,
    "article_code" TEXT NOT NULL,
    "consommation_attendue" INTEGER NOT NULL,
    "consommation_reelle" INTEGER NOT NULL,
    "ecart" INTEGER NOT NULL,

    CONSTRAINT "controle_stock_journalier_pkey" PRIMARY KEY ("jour","article_code")
);

-- CreateTable
CREATE TABLE "reversement" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "numero_facture" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "statut" "StatutReversement" NOT NULL DEFAULT 'A_REVERSER',
    "reverse_le" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reversement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE INDEX "copie_facture_cloturee_le_idx" ON "copie_facture"("cloturee_le");

-- CreateIndex
CREATE UNIQUE INDEX "reversement_facture_id_key" ON "reversement"("facture_id");


-- Ajout manuel (règle du modèle)
ALTER TABLE "reversement" ADD CONSTRAINT "reversement_montant_positif" CHECK ("montant" > 0);
