import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { LienPaiementComptoir } from "../../components/BoutonPayer";
import { DetailFacture } from "../../components/DetailFacture";
import { FormulaireEncaissement } from "../../components/Encaissement";
import {
  Alerte,
  Badge,
  Bouton,
  Chargement,
  Donnees,
  MessageErreur,
  Modale,
  TableDefilante,
  TitrePage,
  classeInput,
  classeTable,
  classeTd,
  classeTh,
} from "../../components/ui";
import { api, messageErreur, qs } from "../../lib/api";
import { ariary, dateCourte, libelle } from "../../lib/format";
import type { Facture, StatutFacture } from "../../lib/types";

const STATUTS: StatutFacture[] = ["EMISE", "PAYEE", "CLOTUREE", "ANNULEE"];

export function Factures() {
  const [params, setParams] = useSearchParams();
  const statut = params.get("statut") ?? "";
  const reservationId = params.get("reservationId") ?? "";
  const [ouverte, setOuverte] = useState<string | null>(null);

  const factures = useQuery({
    queryKey: ["factures", "liste", statut, reservationId],
    queryFn: () => api.get<Facture[]>("/factures" + qs({ statut, reservationId })),
  });

  const changerFiltre = (valeur: string) => {
    const suivant = new URLSearchParams(params);
    if (valeur) suivant.set("statut", valeur);
    else suivant.delete("statut");
    setParams(suivant);
  };

  return (
    <div>
      <TitrePage>Factures</TitrePage>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${classeInput} max-w-xs`} value={statut} onChange={(e) => changerFiltre(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {libelle(s)}
            </option>
          ))}
        </select>
        {reservationId && (
          <Bouton variante="discret" onClick={() => setParams(statut ? { statut } : {})}>
            Retirer le filtre sur la réservation ✕
          </Bouton>
        )}
      </div>

      <Donnees requete={factures} texteVide="Aucune facture pour ce filtre.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Numéro</th>
                  <th className={classeTh}>Client</th>
                  <th className={classeTh}>Émise le</th>
                  <th className={`${classeTh} text-right`}>Total</th>
                  <th className={`${classeTh} text-right`}>Payé</th>
                  <th className={classeTh}>Statut</th>
                  <th className={classeTh}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((f) => (
                  <tr key={f.id}>
                    <td className={`${classeTd} font-mono`}>{f.numero}</td>
                    <td className={classeTd}>{f.clientNom}</td>
                    <td className={classeTd}>{dateCourte(f.emiseLe)}</td>
                    <td className={`${classeTd} text-right`}>{ariary(f.montantTotal)}</td>
                    <td className={`${classeTd} text-right`}>{ariary(f.montantPaye)}</td>
                    <td className={classeTd}>
                      <Badge code={f.statut} />
                    </td>
                    <td className={classeTd}>
                      <Bouton variante="secondaire" className="px-2 py-1 text-xs" onClick={() => setOuverte(f.id)}>
                        Ouvrir
                      </Bouton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>

      {ouverte && <ModaleFacture factureId={ouverte} onFermer={() => setOuverte(null)} />}
    </div>
  );
}

// Détail complet d'une facture + actions de caisse de la réception.
function ModaleFacture({ factureId, onFermer }: { factureId: string; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const facture = useQuery({
    queryKey: ["factures", "detail", factureId],
    queryFn: () => api.get<Facture>(`/factures/${factureId}`),
  });

  const cloture = useMutation({
    mutationFn: () => api.post<Facture>(`/factures/${factureId}/cloturer`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["factures"] }),
  });

  return (
    <Modale titre="Facture" onFermer={onFermer}>
      {facture.isPending && <Chargement />}
      {facture.isError && <MessageErreur erreur={facture.error} />}
      {facture.data && (
        <div className="space-y-4">
          <DetailFacture facture={facture.data} />
          {facture.data.statut === "EMISE" && (
            <>
              <FormulaireEncaissement key={facture.data.montantPaye} facture={facture.data} />
              <LienPaiementComptoir cible={{ factureId: facture.data.id }} />
            </>
          )}
          {facture.data.statut === "PAYEE" && (
            <div className="space-y-2">
              <Bouton enCours={cloture.isPending} onClick={() => cloture.mutate()}>
                Clôturer la facture
              </Bouton>
              {cloture.isError && <Alerte>{messageErreur(cloture.error)}</Alerte>}
            </div>
          )}
        </div>
      )}
    </Modale>
  );
}
