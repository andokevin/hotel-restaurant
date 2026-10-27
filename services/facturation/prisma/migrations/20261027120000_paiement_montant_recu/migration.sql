-- Montant annoncé par Papi pour un paiement classé en ANOMALIE (#67) : base du remboursement.
ALTER TABLE "paiement" ADD COLUMN "montant_recu" INTEGER;
