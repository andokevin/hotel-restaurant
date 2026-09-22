-- CreateEnum
CREATE TYPE "CodeCategorie" AS ENUM ('STANDARD', 'SUITE_SENIOR', 'SUITE_PRESTIGE');

-- CreateEnum
CREATE TYPE "EtatMenage" AS ENUM ('PROPRE', 'SALE', 'EN_NETTOYAGE');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('EN_ATTENTE_PAIEMENT', 'CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "CanalReservation" AS ENUM ('SITE_WEB', 'RECEPTION', 'FACEBOOK', 'ASSISTANT_IA');

-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('FR', 'MG', 'EN');

-- CreateTable
CREATE TABLE "categorie_chambre" (
    "id" UUID NOT NULL,
    "code" "CodeCategorie" NOT NULL,
    "libelle" JSONB NOT NULL,
    "description" JSONB,
    "capacite" INTEGER NOT NULL,
    "tarif_nuit" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categorie_chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chambre" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "etage" INTEGER NOT NULL,
    "categorie_id" UUID NOT NULL,
    "etat_menage" "EtatMenage" NOT NULL DEFAULT 'PROPRE',
    "hors_service" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison" (
    "id" UUID NOT NULL,
    "nom" JSONB NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "saison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarif_saison" (
    "saison_id" UUID NOT NULL,
    "categorie_id" UUID NOT NULL,
    "tarif_nuit" INTEGER NOT NULL,

    CONSTRAINT "tarif_saison_pkey" PRIMARY KEY ("saison_id","categorie_id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "chambre_id" UUID NOT NULL,
    "client_id" UUID,
    "client_nom" TEXT NOT NULL,
    "client_telephone" TEXT NOT NULL,
    "client_email" TEXT,
    "piece_identite_type" TEXT NOT NULL,
    "piece_identite_numero" TEXT NOT NULL,
    "date_arrivee" DATE NOT NULL,
    "date_depart" DATE NOT NULL,
    "montant_total" INTEGER NOT NULL,
    "statut" "StatutReservation" NOT NULL DEFAULT 'EN_ATTENTE_PAIEMENT',
    "canal" "CanalReservation" NOT NULL,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "expire_le" TIMESTAMPTZ,
    "check_in_le" TIMESTAMPTZ,
    "check_out_le" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_nuitee" (
    "reservation_id" UUID NOT NULL,
    "nuit" DATE NOT NULL,
    "tarif_applique" INTEGER NOT NULL,
    "saison_id" UUID,

    CONSTRAINT "reservation_nuitee_pkey" PRIMARY KEY ("reservation_id","nuit")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorie_chambre_code_key" ON "categorie_chambre"("code");

-- CreateIndex
CREATE UNIQUE INDEX "chambre_numero_key" ON "chambre"("numero");

-- CreateIndex
CREATE INDEX "chambre_categorie_id_idx" ON "chambre"("categorie_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_reference_key" ON "reservation"("reference");

-- CreateIndex
CREATE INDEX "reservation_chambre_id_date_arrivee_idx" ON "reservation"("chambre_id", "date_arrivee");

-- CreateIndex
CREATE INDEX "reservation_statut_idx" ON "reservation"("statut");

-- AddForeignKey
ALTER TABLE "chambre" ADD CONSTRAINT "chambre_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie_chambre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif_saison" ADD CONSTRAINT "tarif_saison_saison_id_fkey" FOREIGN KEY ("saison_id") REFERENCES "saison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif_saison" ADD CONSTRAINT "tarif_saison_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie_chambre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_chambre_id_fkey" FOREIGN KEY ("chambre_id") REFERENCES "chambre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_nuitee" ADD CONSTRAINT "reservation_nuitee_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_nuitee" ADD CONSTRAINT "reservation_nuitee_saison_id_fkey" FOREIGN KEY ("saison_id") REFERENCES "saison"("id") ON DELETE SET NULL ON UPDATE CASCADE;
