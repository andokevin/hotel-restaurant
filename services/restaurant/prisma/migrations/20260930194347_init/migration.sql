-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CategoriePlat" AS ENUM ('ENTREE', 'PLAT', 'DESSERT', 'BOISSON');

-- CreateEnum
CREATE TYPE "CanalCommande" AS ENUM ('SUR_PLACE', 'A_EMPORTER', 'LIVRAISON');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('RECUE', 'EN_PREPARATION', 'PRETE', 'REMISE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutPaiementCommande" AS ENUM ('NON_PAYEE', 'PAYEE', 'A_LA_LIVRAISON', 'IMPUTEE_CHAMBRE');

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
CREATE TABLE "menu" (
    "id" UUID NOT NULL,
    "nom" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plat" (
    "id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "nom" JSONB NOT NULL,
    "description" JSONB,
    "categorie" "CategoriePlat" NOT NULL,
    "prix" INTEGER NOT NULL,
    "image_url" TEXT,
    "temps_preparation_min" INTEGER NOT NULL DEFAULT 15,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "disponible_a_distance" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commande" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "canal" "CanalCommande" NOT NULL,
    "table_numero" TEXT,
    "client_id" UUID,
    "client_nom" TEXT,
    "client_telephone" TEXT,
    "heure_souhaitee" TIMESTAMPTZ,
    "statut" "StatutCommande" NOT NULL DEFAULT 'RECUE',
    "statut_paiement" "StatutPaiementCommande" NOT NULL DEFAULT 'NON_PAYEE',
    "reservation_id" UUID,
    "chambre_numero" TEXT,
    "montant_total" INTEGER NOT NULL,
    "frais_livraison" INTEGER NOT NULL DEFAULT 0,
    "servi_par" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ligne_commande" (
    "id" UUID NOT NULL,
    "commande_id" UUID NOT NULL,
    "plat_id" UUID NOT NULL,
    "plat_nom" TEXT NOT NULL,
    "prix_unitaire" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,

    CONSTRAINT "ligne_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteur_commande" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL,

    CONSTRAINT "compteur_commande_pkey" PRIMARY KEY ("annee")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "commande_reference_key" ON "commande"("reference");

-- CreateIndex
CREATE INDEX "commande_statut_idx" ON "commande"("statut");

-- AddForeignKey
ALTER TABLE "plat" ADD CONSTRAINT "plat_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_plat_id_fkey" FOREIGN KEY ("plat_id") REFERENCES "plat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Ajouts manuels (règles du modèle)
ALTER TABLE "plat" ADD CONSTRAINT "plat_prix_positif" CHECK ("prix" > 0);
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_quantite_positive" CHECK ("quantite" > 0 AND "prix_unitaire" > 0);
ALTER TABLE "commande" ADD CONSTRAINT "commande_montants_positifs" CHECK ("montant_total" >= 0 AND "frais_livraison" >= 0);
