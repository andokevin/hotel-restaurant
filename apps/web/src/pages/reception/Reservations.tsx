import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LienPaiementComptoir } from "../../components/BoutonPayer";
import { RecapReservation } from "../../components/RecapReservation";
import {
  Alerte,
  Badge,
  Bouton,
  Donnees,
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
import type { Reservation, StatutReservation } from "../../lib/types";
import { ModaleCheckIn } from "./ModaleCheckIn";

const STATUTS: StatutReservation[] = ["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS", "TERMINEE", "ANNULEE"];

export function Reservations() {
  // Le filtre est gardé dans l'URL (?statut=…) : il survit à un rechargement.
  const [params, setParams] = useSearchParams();
  const statut = params.get("statut") ?? "";

  const reservations = useQuery({
    queryKey: ["reservations", "liste", statut],
    queryFn: () => api.get<Reservation[]>("/reservations" + qs({ statut })),
  });

  const [enCheckIn, setEnCheckIn] = useState<Reservation | null>(null);
  const [detail, setDetail] = useState<Reservation | null>(null);

  return (
    <div>
      <TitrePage
        actions={
          <Link to="/reception/nouvelle" className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
            Nouvelle réservation
          </Link>
        }
      >
        Réservations
      </TitrePage>

      <div className="mb-4 max-w-xs">
        <select
          className={classeInput}
          value={statut}
          onChange={(e) => setParams(e.target.value ? { statut: e.target.value } : {})}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {libelle(s)}
            </option>
          ))}
        </select>
      </div>

      <Donnees requete={reservations} texteVide="Aucune réservation pour ce filtre.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Référence</th>
                  <th className={classeTh}>Client</th>
                  <th className={classeTh}>Séjour</th>
                  <th className={classeTh}>Chambre</th>
                  <th className={`${classeTh} text-right`}>Montant</th>
                  <th className={classeTh}>Statut</th>
                  <th className={classeTh}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((r) => (
                  <tr key={r.id}>
                    <td className={`${classeTd} font-mono`}>
                      <button type="button" className="text-emerald-800 hover:underline" onClick={() => setDetail(r)}>
                        {r.reference}
                      </button>
                    </td>
                    <td className={classeTd}>
                      {r.clientNom}
                      <span className="block text-xs text-slate-500">{r.clientTelephone}</span>
                    </td>
                    <td className={classeTd}>
                      {dateCourte(r.dateArrivee)} → {dateCourte(r.dateDepart)}
                    </td>
                    <td className={classeTd}>{r.chambre?.numero ?? "—"}</td>
                    <td className={`${classeTd} text-right`}>{ariary(r.montantTotal)}</td>
                    <td className={classeTd}>
                      <Badge code={r.statut} />
                    </td>
                    <td className={classeTd}>
                      <ActionsReservation reservation={r} onCheckIn={() => setEnCheckIn(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>

      {enCheckIn && <ModaleCheckIn reservation={enCheckIn} onFermer={() => setEnCheckIn(null)} />}
      {detail && (
        <Modale titre="Détail de la réservation" onFermer={() => setDetail(null)}>
          <RecapReservation reservation={detail} />
          {detail.statut === "EN_ATTENTE_PAIEMENT" && (
            <div className="mt-4">
              <LienPaiementComptoir cible={{ reservationId: detail.id }} />
            </div>
          )}
        </Modale>
      )}
    </div>
  );
}

// Boutons disponibles selon le statut de la réservation.
export function ActionsReservation({ reservation, onCheckIn }: { reservation: Reservation; onCheckIn?: () => void }) {
  const queryClient = useQueryClient();
  const r = reservation;

  const action = useMutation({
    mutationFn: (quoi: "check-out" | "annuler") => api.post<Reservation>(`/reservations/${r.id}/${quoi}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["chambres"] });
      void queryClient.invalidateQueries({ queryKey: ["factures"] });
    },
  });

  const annuler = () => {
    if (window.confirm(`Annuler la réservation ${r.reference} ?`)) action.mutate("annuler");
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {r.statut === "CONFIRMEE" && onCheckIn && (
          <Bouton className="px-2 py-1 text-xs" onClick={onCheckIn}>
            Check-in
          </Bouton>
        )}
        {r.statut === "EN_COURS" && (
          <Bouton className="px-2 py-1 text-xs" enCours={action.isPending} onClick={() => action.mutate("check-out")}>
            Check-out
          </Bouton>
        )}
        {(r.statut === "EN_ATTENTE_PAIEMENT" || r.statut === "CONFIRMEE") && (
          <Bouton variante="secondaire" className="px-2 py-1 text-xs" enCours={action.isPending} onClick={annuler}>
            Annuler
          </Bouton>
        )}
      </div>
      {action.isError && <Alerte>{messageErreur(action.error)}</Alerte>}
    </div>
  );
}
