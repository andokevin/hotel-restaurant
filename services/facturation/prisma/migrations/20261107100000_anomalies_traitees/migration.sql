-- Suivi des anomalies de paiement (#68) : une anomalie est soit remboursée (REMBOURSE),
-- soit acceptée (REUSSI), et chaque action est tracée (qui, quand, commentaire).
ALTER TYPE "StatutPaiement" ADD VALUE 'REMBOURSE';

ALTER TABLE "paiement"
  ADD COLUMN "traite_le" TIMESTAMPTZ,
  ADD COLUMN "traite_par" UUID,
  ADD COLUMN "commentaire" TEXT;
