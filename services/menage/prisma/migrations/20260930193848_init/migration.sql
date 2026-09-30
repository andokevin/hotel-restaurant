-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TypeTache" AS ENUM ('QUOTIDIEN', 'DEPART');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINEE');

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
CREATE TABLE "tache_menage" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "chambre_id" UUID NOT NULL,
    "chambre_numero" TEXT NOT NULL,
    "type" "TypeTache" NOT NULL,
    "date_prevue" DATE NOT NULL,
    "statut" "StatutTache" NOT NULL DEFAULT 'A_FAIRE',
    "assignee_id" UUID,
    "assignee_nom" TEXT,
    "commence_le" TIMESTAMPTZ,
    "termine_le" TIMESTAMPTZ,
    "remarques" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tache_menage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE INDEX "tache_menage_date_prevue_statut_idx" ON "tache_menage"("date_prevue", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "tache_menage_reservation_id_type_date_prevue_key" ON "tache_menage"("reservation_id", "type", "date_prevue");


-- Ajout manuel (règle du modèle)
ALTER TABLE "tache_menage" ADD CONSTRAINT "tache_menage_dates_coherentes" CHECK ("termine_le" IS NULL OR "commence_le" IS NULL OR "termine_le" >= "commence_le");
