import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alerte, Badge, Bouton, Donnees, TableDefilante, TitrePage, classeInput, classeTable, classeTd, classeTh } from "../../components/ui";
import { api, messageErreur, qs } from "../../lib/api";
import { ariary, dateHeure } from "../../lib/format";
import type { Reversement } from "../../lib/types";

// Sommes encaissées pour le restaurant (via les factures de chambre) à lui reverser.
export function Reversements() {
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState("A_REVERSER");

  const reversements = useQuery({
    queryKey: ["reversements", statut],
    queryFn: () => api.get<Reversement[]>("/comptabilite/reversements" + qs({ statut })),
  });

  const effectuer = useMutation({
    mutationFn: (id: string) => api.post<Reversement>(`/comptabilite/reversements/${id}/effectuer`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reversements"] }),
  });

  return (
    <div>
      <TitrePage>Reversements au restaurant</TitrePage>
      <div className="mb-4 max-w-xs">
        <select className={classeInput} value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="A_REVERSER">À reverser</option>
          <option value="REVERSE">Reversés</option>
          <option value="">Tous</option>
        </select>
      </div>
      {effectuer.isError && (
        <div className="mb-3">
          <Alerte>{messageErreur(effectuer.error)}</Alerte>
        </div>
      )}
      <Donnees requete={reversements} texteVide="Aucun reversement.">
        {(liste) => (
          <>
            {statut === "A_REVERSER" && (
              <p className="mb-2 text-sm text-slate-600">
                Total à reverser : <strong>{ariary(liste.reduce((s, r) => s + r.montant, 0))}</strong>
              </p>
            )}
            <TableDefilante>
              <table className={classeTable}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={classeTh}>Facture</th>
                    <th className={`${classeTh} text-right`}>Montant</th>
                    <th className={classeTh}>Statut</th>
                    <th className={classeTh}>Reversé le</th>
                    <th className={classeTh}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liste.map((r) => (
                    <tr key={r.id}>
                      <td className={`${classeTd} font-mono`}>{r.numeroFacture}</td>
                      <td className={`${classeTd} text-right`}>{ariary(r.montant)}</td>
                      <td className={classeTd}>
                        <Badge code={r.statut} />
                      </td>
                      <td className={classeTd}>{dateHeure(r.reverseLe)}</td>
                      <td className={classeTd}>
                        {r.statut === "A_REVERSER" && (
                          <Bouton
                            className="px-2 py-1 text-xs"
                            enCours={effectuer.isPending && effectuer.variables === r.id}
                            onClick={() => effectuer.mutate(r.id)}
                          >
                            Marquer reversé
                          </Bouton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableDefilante>
          </>
        )}
      </Donnees>
    </div>
  );
}
