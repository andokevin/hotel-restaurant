import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { BoutonPayer } from "../../components/BoutonPayer";
import { RecapReservation } from "../../components/RecapReservation";
import { Carte, Donnees, TitrePage } from "../../components/ui";
import { api } from "../../lib/api";
import type { Reservation } from "../../lib/types";

export function MesReservations() {
  const reservations = useQuery({
    queryKey: ["reservations", "miennes"],
    queryFn: () => api.get<Reservation[]>("/reservations/mes-reservations"),
    // Après un paiement, la confirmation arrive par événement (quelques secondes) :
    // tant qu'une réservation attend son paiement, on relit la liste toutes les 3 s.
    refetchInterval: (requete) =>
      requete.state.data?.some((r) => r.statut === "EN_ATTENTE_PAIEMENT") ? 3_000 : false,
  });

  return (
    <div>
      <TitrePage
        actions={
          <Link to="/client/reserver" className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
            Nouvelle réservation
          </Link>
        }
      >
        Mes réservations
      </TitrePage>
      <Donnees requete={reservations} texteVide="Vous n'avez encore aucune réservation.">
        {(liste) => (
          <div className="grid gap-4 md:grid-cols-2">
            {liste.map((r) => (
              <Carte key={r.id}>
                <RecapReservation reservation={r} />
                {r.statut === "EN_ATTENTE_PAIEMENT" && (
                  <div className="mt-3">
                    <BoutonPayer cible={{ reservationId: r.id }} />
                  </div>
                )}
              </Carte>
            ))}
          </div>
        )}
      </Donnees>
    </div>
  );
}
