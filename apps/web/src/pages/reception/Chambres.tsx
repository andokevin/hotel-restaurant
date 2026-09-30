import { useState } from "react";
import { Badge, Donnees, TitrePage, classeInput } from "../../components/ui";
import { libelle, texte } from "../../lib/format";
import { useChambres } from "../../lib/requetes";
import type { EtatMenage } from "../../lib/types";

const ETATS: EtatMenage[] = ["PROPRE", "SALE", "EN_NETTOYAGE"];

// État des chambres (ménage) : sert à la réception pour savoir quelles chambres attribuer.
export function EtatChambres() {
  const [etat, setEtat] = useState<EtatMenage | "">("");
  const chambres = useChambres(etat || undefined);

  return (
    <div>
      <TitrePage>État des chambres</TitrePage>
      <div className="mb-4 max-w-xs">
        <select
          className={classeInput}
          value={etat}
          onChange={(e) => {
            const v = e.target.value;
            setEtat(v === "PROPRE" || v === "SALE" || v === "EN_NETTOYAGE" ? v : "");
          }}
          aria-label="Filtrer par état"
        >
          <option value="">Tous les états</option>
          {ETATS.map((e) => (
            <option key={e} value={e}>
              {libelle(e)}
            </option>
          ))}
        </select>
      </div>
      <Donnees requete={chambres} texteVide="Aucune chambre.">
        {(liste) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[...liste]
              .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }))
              .map((c) => (
                <div key={c.id} className={`rounded-lg border bg-white p-3 text-sm shadow-sm ${c.horsService ? "border-red-300 opacity-70" : "border-slate-200"}`}>
                  <div className="text-lg font-bold">n° {c.numero}</div>
                  <div className="text-xs text-slate-500">
                    Étage {c.etage}
                    {c.categorie && ` · ${texte(c.categorie.libelle)}`}
                  </div>
                  <div className="mt-2">
                    <Badge code={c.etatMenage} />
                  </div>
                  {c.horsService && <div className="mt-1 text-xs font-medium text-red-700">Hors service</div>}
                </div>
              ))}
          </div>
        )}
      </Donnees>
    </div>
  );
}
