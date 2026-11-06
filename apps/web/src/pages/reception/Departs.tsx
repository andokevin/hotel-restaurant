import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bouton, Donnees, TableDefilante, TitrePage, classeTable, classeTd, classeTh } from "../../components/ui";
import { api, qs } from "../../lib/api";
import { ariary, dateCourte, personnes } from "../../lib/format";
import type { Facture, Reservation } from "../../lib/types";
import { ModaleFacture } from "./Factures";
import { ActionsReservation } from "./Reservations";

// Séjours EN_COURS dont la date de départ est atteinte : à passer en check-out.
// Chaque ligne montre ce qu'il reste à payer sur la facture du séjour, et permet de l'encaisser sur place.
export function Departs() {
  const [factureOuverte, setFactureOuverte] = useState<string | null>(null);
  const departs = useQuery({
    queryKey: ["reservations", "departs"],
    queryFn: () => api.get<Reservation[]>("/reservations/departs"),
  });

  return (
    <div>
      <TitrePage>Départs du jour</TitrePage>
      <Donnees requete={departs} texteVide="Aucun départ prévu aujourd'hui.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Référence</th>
                  <th className={classeTh}>Client</th>
                  <th className={classeTh}>Chambre</th>
                  <th className={classeTh}>Départ prévu</th>
                  <th className={`${classeTh} text-right`}>Montant</th>
                  <th className={`${classeTh} text-right`}>Reste à payer</th>
                  <th className={classeTh}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((r) => (
                  <LigneDepart key={r.id} reservation={r} onEncaisser={setFactureOuverte} />
                ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>

      {factureOuverte && <ModaleFacture factureId={factureOuverte} onFermer={() => setFactureOuverte(null)} />}
    </div>
  );
}

function LigneDepart({ reservation: r, onEncaisser }: { reservation: Reservation; onEncaisser: (factureId: string) => void }) {
  // Clé sous ["factures"] : un encaissement (qui invalide ["factures"]) met la ligne à jour tout seul.
  const factures = useQuery({
    queryKey: ["factures", "reservation", r.id],
    queryFn: () => api.get<Facture[]>("/factures" + qs({ reservationId: r.id })),
  });
  const facture = factures.data?.[0];
  const reste = facture ? facture.montantTotal - facture.montantPaye : null;

  return (
    <tr>
      <td className={`${classeTd} font-mono`}>{r.reference}</td>
      <td className={classeTd}>
        {r.clientNom}
        <span className="block text-xs text-slate-500">{personnes(r)}</span>
      </td>
      <td className={classeTd}>{r.chambre?.numero ?? "—"}</td>
      <td className={classeTd}>{dateCourte(r.dateDepart)}</td>
      <td className={`${classeTd} text-right`}>{ariary(r.montantTotal)}</td>
      <td className={`${classeTd} text-right`}>
        {factures.isPending ? (
          <span className="text-slate-400">…</span>
        ) : reste === null ? (
          <span className="text-slate-400" title="Facture introuvable">—</span>
        ) : reste > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold text-red-700">{ariary(reste)}</span>
            {facture && (
              <Bouton taille="petit" onClick={() => onEncaisser(facture.id)}>
                Encaisser
              </Bouton>
            )}
          </div>
        ) : (
          <span className="font-medium text-emerald-700">Soldée</span>
        )}
      </td>
      <td className={classeTd}>
        <ActionsReservation reservation={r} resteAPayer={reste} />
      </td>
    </tr>
  );
}
