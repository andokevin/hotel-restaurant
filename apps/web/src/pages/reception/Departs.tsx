import { useQuery } from "@tanstack/react-query";
import { Donnees, TableDefilante, TitrePage, classeTable, classeTd, classeTh } from "../../components/ui";
import { api } from "../../lib/api";
import { ariary, dateCourte } from "../../lib/format";
import type { Reservation } from "../../lib/types";
import { ActionsReservation } from "./Reservations";

// Séjours EN_COURS dont la date de départ est atteinte : à passer en check-out.
export function Departs() {
  const departs = useQuery({
    queryKey: ["reservations", "departs"],
    queryFn: () => api.get<Reservation[]>("/reservations/departs"),
  });

  return (
    <div>
      <TitrePage>Départs du jour</TitrePage>
      <p className="mb-4 text-sm text-slate-600">
        Au check-out, pensez à vérifier que la facture est soldée (écran Factures) avant de la clôturer.
      </p>
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
                  <th className={classeTh}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((r) => (
                  <tr key={r.id}>
                    <td className={`${classeTd} font-mono`}>{r.reference}</td>
                    <td className={classeTd}>{r.clientNom}</td>
                    <td className={classeTd}>{r.chambre?.numero ?? "—"}</td>
                    <td className={classeTd}>{dateCourte(r.dateDepart)}</td>
                    <td className={`${classeTd} text-right`}>{ariary(r.montantTotal)}</td>
                    <td className={classeTd}>
                      <ActionsReservation reservation={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>
    </div>
  );
}
