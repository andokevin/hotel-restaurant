import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { BoutonPayer } from "../../components/BoutonPayer";
import { FormulaireReservation } from "../../components/FormulaireReservation";
import { RecapReservation } from "../../components/RecapReservation";
import { Alerte, Bouton, Carte, TitrePage } from "../../components/ui";
import type { Reservation } from "../../lib/types";

export function Reserver() {
  const { utilisateur } = useAuth();
  const [creee, setCreee] = useState<Reservation | null>(null);

  // Étape 2 : la réservation existe, il reste à la payer (30 minutes).
  if (creee) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <TitrePage>Réservation enregistrée</TitrePage>
        <Carte>
          <RecapReservation reservation={creee} />
        </Carte>
        <Alerte type="attention">
          Votre chambre est bloquée pendant 30 minutes. Sans paiement dans ce délai, la réservation est annulée
          automatiquement.
        </Alerte>
        <div className="flex flex-wrap items-start gap-3">
          <BoutonPayer cible={{ reservationId: creee.id }} />
          <Bouton variante="secondaire" onClick={() => setCreee(null)}>
            Nouvelle réservation
          </Bouton>
          <Link to="/client/reservations" className="px-3 py-2 text-sm text-emerald-800 hover:underline">
            Voir mes réservations
          </Link>
        </div>
      </div>
    );
  }

  // Étape 1 : le formulaire.
  return (
    <div className="mx-auto max-w-2xl">
      <TitrePage>Réserver une chambre</TitrePage>
      <Carte>
        <FormulaireReservation
          personnel={false}
          client={utilisateur ? { nom: utilisateur.nom, telephone: utilisateur.telephone, email: utilisateur.email } : undefined}
          onCreee={setCreee}
        />
      </Carte>
    </div>
  );
}
