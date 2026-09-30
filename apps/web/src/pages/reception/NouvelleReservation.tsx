import { useState } from "react";
import { Link } from "react-router";
import { LienPaiementComptoir } from "../../components/BoutonPayer";
import { FormulaireReservation } from "../../components/FormulaireReservation";
import { RecapReservation } from "../../components/RecapReservation";
import { Bouton, Carte, TitrePage } from "../../components/ui";
import type { Reservation } from "../../lib/types";

// Réservation saisie au comptoir (ou reçue par Facebook) par la réception.
export function NouvelleReservation() {
  const [creee, setCreee] = useState<Reservation | null>(null);
  // Change la « key » du formulaire pour repartir d'un formulaire vierge (nouvelle clé d'idempotence).
  const [numeroFormulaire, setNumeroFormulaire] = useState(0);

  if (creee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <TitrePage>Réservation enregistrée</TitrePage>
        <Carte>
          <RecapReservation reservation={creee} />
        </Carte>
        <Carte titre="Paiement">
          <p className="mb-3 text-sm text-slate-600">
            Le client peut payer par Papi (lien ci-dessous). Une fois la réservation confirmée, la facture pourra aussi être
            réglée en espèces depuis l'écran Factures.
          </p>
          <LienPaiementComptoir cible={{ reservationId: creee.id }} />
        </Carte>
        <div className="flex flex-wrap gap-3">
          <Bouton
            variante="secondaire"
            onClick={() => {
              setCreee(null);
              setNumeroFormulaire((n) => n + 1);
            }}
          >
            Nouvelle réservation
          </Bouton>
          <Link to="/reception/reservations" className="px-3 py-2 text-sm text-emerald-800 hover:underline">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TitrePage>Nouvelle réservation au comptoir</TitrePage>
      <Carte>
        <FormulaireReservation key={numeroFormulaire} personnel onCreee={setCreee} />
      </Carte>
    </div>
  );
}
