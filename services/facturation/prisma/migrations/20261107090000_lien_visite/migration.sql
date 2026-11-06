-- Lien Papi visité (#69) : date du retour du client depuis Papi. Facultative : les paiements
-- existants n'ont jamais été marqués (la règle des 30 s continue de s'appliquer à eux).
ALTER TABLE "paiement" ADD COLUMN "visite_le" TIMESTAMPTZ;
