import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LienPaiementComptoir } from "../../components/BoutonPayer";
import { RecapReservation } from "../../components/RecapReservation";
import {
  Badge,
  Bouton,
  ChampRecherche,
  Donnees,
  Modale,
  ModaleConfirmation,
  Pastilles,
  TableDefilante,
  TitrePage,
  Vide,
  classeBouton,
  classeInput,
  classeTable,
  classeTd,
  classeTh,
} from "../../components/ui";
import { api, qs } from "../../lib/api";
import { ariary, aujourdhui, dateCourte, libelle } from "../../lib/format";
import type { Reservation, StatutReservation } from "../../lib/types";
import { ModaleCheckIn } from "./ModaleCheckIn";

const STATUTS: StatutReservation[] = ["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS", "TERMINEE", "ANNULEE"];

// Vues rapides de la journée de la réception (calculées sur la liste chargée).
type Vue = "toutes" | "arrivees" | "departs" | "enCours";
const jour = (date: string) => date.slice(0, 10);
const FILTRES_VUE: Record<Vue, (r: Reservation, auj: string) => boolean> = {
  toutes: () => true,
  arrivees: (r, auj) => r.statut === "CONFIRMEE" && jour(r.dateArrivee) <= auj,
  departs: (r, auj) => r.statut === "EN_COURS" && jour(r.dateDepart) <= auj,
  enCours: (r) => r.statut === "EN_COURS",
};

// Recherche sans tenir compte des accents ni des majuscules.
const normaliser = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Reservations() {
  // Les filtres sont gardés dans l'URL (?statut=…&vue=…) : ils survivent à un rechargement.
  const [params, setParams] = useSearchParams();
  const statut = params.get("statut") ?? "";
  const vue = (params.get("vue") as Vue | null) ?? "toutes";
  const [recherche, setRecherche] = useState("");

  const reservations = useQuery({
    queryKey: ["reservations", "liste", statut],
    queryFn: () => api.get<Reservation[]>("/reservations" + qs({ statut })),
  });

  const [enCheckIn, setEnCheckIn] = useState<Reservation | null>(null);
  const [detail, setDetail] = useState<Reservation | null>(null);

  const changerParam = (cle: string, valeur: string, parDefaut: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (valeur && valeur !== parDefaut) n.set(cle, valeur);
      else n.delete(cle);
      return n;
    });

  const auj = aujourdhui();
  const liste = reservations.data ?? [];
  const nombre = (v: Vue) => liste.filter((r) => FILTRES_VUE[v](r, auj)).length;
  const terme = normaliser(recherche.trim());
  const filtrees = liste
    .filter((r) => FILTRES_VUE[vue](r, auj))
    .filter((r) => !terme || normaliser(`${r.reference} ${r.clientNom} ${r.clientTelephone ?? ""} ${r.chambre?.numero ?? ""}`).includes(terme));

  return (
    <div>
      <TitrePage
        sousTitre="Arrivées, départs et suivi des séjours"
        actions={
          <Link to="/reception/nouvelle" className={classeBouton("accent")}>
            + Nouvelle réservation
          </Link>
        }
      >
        Réservations
      </TitrePage>

      <div className="mb-4 space-y-3">
        <Pastilles<Vue>
          label="Vue rapide"
          valeur={vue}
          onChange={(v) => changerParam("vue", v, "toutes")}
          options={[
            { valeur: "toutes", libelle: "Toutes", nombre: liste.length },
            { valeur: "arrivees", libelle: "Arrivées du jour", nombre: nombre("arrivees") },
            { valeur: "departs", libelle: "Départs du jour", nombre: nombre("departs") },
            { valeur: "enCours", libelle: "Séjours en cours", nombre: nombre("enCours") },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher : référence, client, téléphone, chambre" />
          <select
            className={classeInput}
            value={statut}
            onChange={(e) => changerParam("statut", e.target.value, "")}
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
      </div>

      <Donnees requete={reservations} texteVide="Aucune réservation pour ce filtre.">
        {() =>
          filtrees.length === 0 ? (
            <Vide
              texte={recherche ? `Aucune réservation ne correspond à « ${recherche} ».` : "Aucune réservation dans cette vue."}
              action={
                (recherche || vue !== "toutes") && (
                  <Bouton
                    variante="secondaire"
                    onClick={() => {
                      setRecherche("");
                      changerParam("vue", "toutes", "toutes");
                    }}
                  >
                    Tout afficher
                  </Bouton>
                )
              }
            />
          ) : (
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
                {filtrees.map((r) => (
                  <tr key={r.id} className="hover:bg-sable-50">
                    <td className={`${classeTd} font-mono`}>
                      <button
                        type="button"
                        className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:decoration-emerald-700"
                        onClick={() => setDetail(r)}
                        title="Voir le détail"
                      >
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
          )
        }
      </Donnees>

      {enCheckIn && <ModaleCheckIn reservation={enCheckIn} onFermer={() => setEnCheckIn(null)} />}
      {detail && (
        <Modale titre="Détail de la réservation" onFermer={() => setDetail(null)}>
          <DetailReservation id={detail.id} />
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

// Détail complet (avec les nuitées) chargé à l'ouverture : la liste, elle, ne les contient pas.
function DetailReservation({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ["reservations", "detail", id],
    queryFn: () => api.get<Reservation>(`/reservations/${id}`),
  });
  return <Donnees requete={detail}>{(r) => <RecapReservation reservation={r} />}</Donnees>;
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

  // Action en attente de confirmation : rien n'est envoyé au serveur avant le clic sur « Confirmer ».
  const [aConfirmer, setAConfirmer] = useState<"check-out" | "annuler" | null>(null);
  const fermer = () => {
    setAConfirmer(null);
    action.reset();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {r.statut === "CONFIRMEE" && onCheckIn && (
          <Bouton taille="petit" onClick={onCheckIn}>
            Check-in
          </Bouton>
        )}
        {r.statut === "EN_COURS" && (
          <Bouton taille="petit" onClick={() => setAConfirmer("check-out")}>
            Check-out
          </Bouton>
        )}
        {(r.statut === "EN_ATTENTE_PAIEMENT" || r.statut === "CONFIRMEE") && (
          // Séparé de « Check-in » et en style discret rouge : on ne l'atteint pas par erreur.
          <Bouton variante="discretDanger" taille="petit" className="sm:ml-2" onClick={() => setAConfirmer("annuler")}>
            Annuler
          </Bouton>
        )}
      </div>

      {aConfirmer === "check-out" && (
        <ModaleConfirmation
          titre={`Check-out — chambre ${r.chambre?.numero ?? "?"}`}
          libelleConfirmer="Confirmer le départ"
          enCours={action.isPending}
          erreur={action.error}
          onConfirmer={() => action.mutate("check-out", { onSuccess: () => setAConfirmer(null) })}
          onAnnuler={fermer}
        >
          <p>
            <strong>{r.clientNom}</strong> quitte la chambre <strong>{r.chambre?.numero ?? "?"}</strong> (réservation {r.reference}).
          </p>
          <p className="mt-2 text-slate-600">
            Le séjour sera terminé, la chambre passera à « Sale » et une tâche de ménage sera créée. Vérifiez d'abord que la facture est réglée.
          </p>
        </ModaleConfirmation>
      )}
      {aConfirmer === "annuler" && (
        <ModaleConfirmation
          titre={`Annuler la réservation ${r.reference} ?`}
          libelleConfirmer="Oui, annuler la réservation"
          variante="danger"
          enCours={action.isPending}
          erreur={action.error}
          onConfirmer={() => action.mutate("annuler", { onSuccess: () => setAConfirmer(null) })}
          onAnnuler={fermer}
        >
          <p>
            Réservation de <strong>{r.clientNom}</strong> du {dateCourte(r.dateArrivee)} au {dateCourte(r.dateDepart)}. Cette action est définitive :
            la chambre sera libérée pour ces dates.
          </p>
        </ModaleConfirmation>
      )}
    </>
  );
}
