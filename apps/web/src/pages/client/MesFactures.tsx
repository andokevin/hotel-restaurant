import { useQuery } from "@tanstack/react-query";
import { BoutonPayer } from "../../components/BoutonPayer";
import { DetailFacture } from "../../components/DetailFacture";
import { Carte, Donnees, TitrePage } from "../../components/ui";
import { api } from "../../lib/api";
import type { Facture } from "../../lib/types";

export function MesFactures() {
  const factures = useQuery({
    queryKey: ["factures", "miennes"],
    queryFn: () => api.get<Facture[]>("/factures/mes-factures"),
  });

  return (
    <div>
      <TitrePage>Mes factures</TitrePage>
      <Donnees requete={factures} texteVide="Vous n'avez aucune facture.">
        {(liste) => (
          <div className="space-y-4">
            {liste.map((f) => (
              <Carte key={f.id}>
                <DetailFacture facture={f} />
                {f.statut === "EMISE" && f.montantPaye < f.montantTotal && (
                  <div className="mt-3">
                    <BoutonPayer cible={{ factureId: f.id }} libelleBouton="Payer le solde avec Papi" />
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
