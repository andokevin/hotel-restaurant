-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE');

-- CreateEnum
CREATE TYPE "MotifMouvement" AS ENUM ('APPROVISIONNEMENT', 'MENAGE', 'AJUSTEMENT_INVENTAIRE', 'PERTE');

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
CREATE TABLE "article" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" JSONB NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "seuil_alerte" INTEGER NOT NULL,
    "consommation_par_nuitee" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvement" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "motif" "MotifMouvement" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "reference_id" UUID,
    "chambre_numero" TEXT,
    "effectue_par" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "article_code_key" ON "article"("code");

-- CreateIndex
CREATE INDEX "mouvement_motif_created_at_idx" ON "mouvement"("motif", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mouvement_reference_id_article_id_key" ON "mouvement"("reference_id", "article_id");

-- AddForeignKey
ALTER TABLE "mouvement" ADD CONSTRAINT "mouvement_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Ajouts manuels (règles du modèle)
-- Le stock ne peut JAMAIS être négatif : une sortie qui le ferait passer sous zéro est refusée par la base.
ALTER TABLE "article" ADD CONSTRAINT "stock_jamais_negatif" CHECK ("quantite" >= 0);
ALTER TABLE "article" ADD CONSTRAINT "article_parametres_positifs" CHECK ("seuil_alerte" >= 0 AND "consommation_par_nuitee" >= 0);
ALTER TABLE "mouvement" ADD CONSTRAINT "mouvement_quantite_positive" CHECK ("quantite" > 0);
