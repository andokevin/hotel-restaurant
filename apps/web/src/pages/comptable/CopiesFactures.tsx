import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DetailFacture } from "../../components/DetailFacture";
import { Carte, Champ, Donnees, TitrePage, classeInput } from "../../components/ui";
import { api, qs } from "../../lib/api";
import { ajouterJours, ariary, aujourdhui } from "../../lib/format";
import type { Facture } from "../../lib/types";

// Copies des factures clôturées un jour donné (archives comptables).
export function CopiesFactures() {
  const [jour, setJour] = useState(ajouterJours(aujourdhui(), -1));
  const factures = useQuery({
    queryKey: ["factures", "copies", jour],
    queryFn: () => api.get<Facture[]>("/comptabilite/factures" + qs({ jour })),
  });

  return (
    <div>
      <TitrePage>Copies de factures</TitrePage>
      <div className="mb-4 w-48">
        <Champ label="Jour de clôture">
          <input type="date" className={classeInput} value={jour} onChange={(e) => setJour(e.target.value)} />
        </Champ>
      </div>
      <Donnees requete={factures} texteVide="Aucune facture clôturée ce jour-là.">
        {(liste) => (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {liste.length} facture(s) · total <strong>{ariary(liste.reduce((s, f) => s + f.montantTotal, 0))}</strong>
            </p>
            {liste.map((f) => (
              <Carte key={f.id}>
                <DetailFacture facture={f} />
              </Carte>
            ))}
          </div>
        )}
      </Donnees>
    </div>
  );
}
