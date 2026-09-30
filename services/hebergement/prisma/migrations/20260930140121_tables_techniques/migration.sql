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
CREATE TABLE "cle_idempotence" (
    "cle" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "utilisateur_id" UUID,
    "reponse" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cle_idempotence_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE INDEX "outbox_evenement_publie_le_created_at_idx" ON "outbox_evenement"("publie_le", "created_at");

-- CreateIndex
CREATE INDEX "reservation_client_id_idx" ON "reservation"("client_id");
