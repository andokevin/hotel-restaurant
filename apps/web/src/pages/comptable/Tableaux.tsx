import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alerte, Bouton, Carte, Champ, Donnees, TitrePage, classeInput, classeTd, classeTh } from "../../components/ui";
import { api, messageErreur, qs } from "../../lib/api";
import { ajouterJours, ariary, aujourdhui, dateCourte, dateHeure } from "../../lib/format";
import type { TableauJournalier } from "../../lib/types";

// Tableaux de bord journaliers : chiffre d'affaires et contrôle du stock (attendu vs réel).
export function Tableaux() {
  const queryClient = useQueryClient();
  const [du, setDu] = useState(ajouterJours(aujourdhui(), -7));
  const [au, setAu] = useState(aujourdhui());
  const [jourAGenerer, setJourAGenerer] = useState(ajouterJours(aujourdhui(), -1));

  const tableaux = useQuery({
    queryKey: ["tableaux", du, au],
    queryFn: () => api.get<TableauJournalier[]>("/comptabilite/tableaux" + qs({ du, au })),
  });

  const generation = useMutation({
    mutationFn: () => api.post<TableauJournalier>("/comptabilite/tableaux/generer", jourAGenerer ? { jour: jourAGenerer } : {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tableaux"] }),
  });

  return (
    <div className="space-y-6">
      <TitrePage>Tableaux de bord journaliers</TitrePage>

      <div className="grid gap-4 md:grid-cols-2">
        <Carte titre="Période">
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Du">
              <input type="date" className={classeInput} value={du} onChange={(e) => setDu(e.target.value)} />
            </Champ>
            <Champ label="Au">
              <input type="date" className={classeInput} value={au} onChange={(e) => setAu(e.target.value)} />
            </Champ>
          </div>
        </Carte>
        <Carte titre="Générer un tableau">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-44">
              <Champ label="Jour">
                <input type="date" className={classeInput} value={jourAGenerer} onChange={(e) => setJourAGenerer(e.target.value)} />
              </Champ>
            </div>
            <Bouton enCours={generation.isPending} onClick={() => generation.mutate()}>
              Générer
            </Bouton>
          </div>
          {generation.isError && (
            <div className="mt-2">
              <Alerte>{messageErreur(generation.error)}</Alerte>
            </div>
          )}
          {generation.isSuccess && (
            <div className="mt-2">
              <Alerte type="succes">Tableau généré.</Alerte>
            </div>
          )}
        </Carte>
      </div>

      <Donnees requete={tableaux} texteVide="Aucun tableau sur cette période. Générez-en un ci-dessus.">
        {(liste) => (
          <div className="space-y-4">
            {liste.map((t) => (
              <CarteTableau key={t.jour} tableau={t} />
            ))}
          </div>
        )}
      </Donnees>
    </div>
  );
}

function CarteTableau({ tableau: t }: { tableau: TableauJournalier }) {
  const ecarts = t.controles.filter((c) => c.ecart !== 0).length;
  return (
    <Carte titre={`Journée du ${dateCourte(t.jour)}`}>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Indicateur libelle="Nuitées vendues" valeur={String(t.nuiteesVendues)} />
        <Indicateur libelle="Factures" valeur={String(t.nombreFactures)} />
        <Indicateur libelle="CA hébergement" valeur={ariary(t.caHebergement)} />
        <Indicateur libelle="CA restaurant" valeur={ariary(t.caRestaurant)} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Total : <strong>{ariary(t.caHebergement + t.caRestaurant)}</strong> · généré le {dateHeure(t.genereLe)}
      </p>

      {t.controles.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="mb-1 text-sm font-semibold">
            Contrôle du stock{" "}
            {ecarts > 0 ? <span className="text-red-700">({ecarts} écart(s))</span> : <span className="text-emerald-700">(aucun écart)</span>}
          </h3>
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={classeTh}>Article</th>
                <th className={`${classeTh} text-right`}>Attendu</th>
                <th className={`${classeTh} text-right`}>Réel</th>
                <th className={`${classeTh} text-right`}>Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {t.controles.map((c) => (
                // Écart en rouge : consommation réelle différente de l'attendu (perte, oubli de saisie…).
                <tr key={c.articleCode} className={c.ecart !== 0 ? "bg-red-50 font-medium text-red-700" : ""}>
                  <td className={classeTd}>{c.articleCode}</td>
                  <td className={`${classeTd} text-right`}>{c.consommationAttendue}</td>
                  <td className={`${classeTd} text-right`}>{c.consommationReelle}</td>
                  <td className={`${classeTd} text-right`}>
                    {c.ecart > 0 ? "+" : ""}
                    {c.ecart}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}

function Indicateur({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{libelle}</div>
      <div className="text-lg font-semibold">{valeur}</div>
    </div>
  );
}
