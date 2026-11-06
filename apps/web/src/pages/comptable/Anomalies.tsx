import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alerte, Badge, Bouton, Donnees, ModaleConfirmation, TitrePage, classeInput } from "../../components/ui";
import { api } from "../../lib/api";
import { ariary, dateHeure, libelle } from "../../lib/format";
import type { Anomalie } from "../../lib/types";

// Même clé que le badge du menu (Layout) : une action met à jour la liste ET le compteur.
export const CLE_ANOMALIES = ["paiements", "anomalies"] as const;
export const lireAnomalies = () => api.get<Anomalie[]>("/paiements/anomalies");

type Action = { anomalie: Anomalie; type: "rembourse" | "accepter" };

// Anomalies de paiement : argent DÉBITÉ chez le client mais non compté (montant différent, facture déjà
// soldée, lien remplacé…). Le comptable rembourse dans le tableau de bord Papi puis le trace ici,
// ou accepte le paiement si la facture attend encore cet argent.
export function Anomalies() {
  const anomalies = useQuery({ queryKey: CLE_ANOMALIES, queryFn: lireAnomalies });
  const [action, setAction] = useState<Action | null>(null);

  return (
    <div>
      <TitrePage sousTitre="Argent débité chez le client mais non compté : à rembourser ou à accepter">Anomalies de paiement</TitrePage>
      <Donnees requete={anomalies} texteVide="Aucune anomalie à traiter. Tous les paiements reçus sont comptés.">
        {(liste) => (
          <div className="space-y-4">
            {liste.map((a) => (
              <CarteAnomalie key={a.id} anomalie={a} onAction={(type) => setAction({ anomalie: a, type })} />
            ))}
          </div>
        )}
      </Donnees>
      {action && <ModaleTraitement action={action} onFermer={() => setAction(null)} />}
    </div>
  );
}

function CarteAnomalie({ anomalie: a, onAction }: { anomalie: Anomalie; onAction: (type: Action["type"]) => void }) {
  const f = a.facture;
  return (
    <article aria-label={`Anomalie sur la facture ${f.numero}`} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{ariary(a.montantRecu ?? a.montant)}</p>
          <p className="text-sm text-slate-600">
            reçu le {dateHeure(a.createdAt)} · {libelle(a.methode)}
          </p>
        </div>
        <Badge code={a.situation} />
      </div>

      {a.raison && <p className="mt-2 text-sm font-medium text-red-800">{a.raison}</p>}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Référence Papi</dt>
        <dd className="font-mono break-all">{a.referenceExterne ?? "—"}</dd>
        <dt className="text-slate-500">Facture</dt>
        <dd>
          <span className="font-mono">{f.numero}</span> · {libelle(f.statut)} · reste à payer {ariary(f.resteAPayer)}
        </dd>
        <dt className="text-slate-500">Client</dt>
        <dd>
          {f.clientNom}
          {f.clientTelephone && ` · ${f.clientTelephone}`}
          {f.clientEmail && ` · ${f.clientEmail}`}
        </dd>
      </dl>

      <details className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-slate-600">Tous les paiements de la facture ({f.paiements.length})</summary>
        <ul className="mt-2 space-y-1">
          {f.paiements.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span>{ariary(p.montant)}</span>
              <span className="text-slate-500">{libelle(p.methode)}</span>
              <Badge code={p.statut} />
              <span className="text-xs text-slate-500">{dateHeure(p.createdAt)}</span>
              {p.id === a.id && <span className="text-xs font-medium text-red-700">← cette anomalie</span>}
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton variante={a.situation === "A_REMBOURSER" ? "primaire" : "secondaire"} onClick={() => onAction("rembourse")}>
          Marquer remboursé
        </Bouton>
        {a.situation === "A_ACCEPTER" && <Bouton onClick={() => onAction("accepter")}>Accepter ce paiement</Bouton>}
      </div>
    </article>
  );
}

function ModaleTraitement({ action, onFermer }: { action: Action; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const { anomalie: a, type } = action;
  const [commentaire, setCommentaire] = useState("");
  const [manquant, setManquant] = useState(false);

  const traiter = useMutation({
    mutationFn: () => api.post(`/paiements/${a.id}/${type}`, { commentaire: commentaire.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLE_ANOMALIES });
      void queryClient.invalidateQueries({ queryKey: ["factures"] });
      onFermer();
    },
  });

  const confirmer = () => {
    // Trace obligatoire pour la comptabilité (le serveur exige aussi 3 caractères au moins)
    if (commentaire.trim().length < 3) {
      setManquant(true);
      return;
    }
    traiter.mutate();
  };

  const rembourse = type === "rembourse";
  return (
    <ModaleConfirmation
      titre={rembourse ? "Marquer comme remboursé" : "Accepter ce paiement"}
      libelleConfirmer={rembourse ? "Confirmer le remboursement" : "Confirmer et encaisser"}
      enCours={traiter.isPending}
      erreur={traiter.error}
      onConfirmer={confirmer}
      onAnnuler={onFermer}
    >
      <div className="space-y-3">
        {rembourse ? (
          <p>
            Remboursez d'abord <strong>{ariary(a.montantRecu ?? a.montant)}</strong> à {a.facture.clientNom} dans le tableau de bord
            Papi (référence <span className="font-mono">{a.referenceExterne ?? "—"}</span>), puis confirmez ici.
          </p>
        ) : (
          <p>
            <strong>{ariary(a.montantRecu ?? a.montant)}</strong> sera encaissé sur la facture {a.facture.numero} (reste à payer :{" "}
            {ariary(a.facture.resteAPayer)}).
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Commentaire</span>
          <textarea
            className={classeInput}
            rows={3}
            maxLength={500}
            value={commentaire}
            onChange={(e) => {
              setCommentaire(e.target.value);
              setManquant(false);
            }}
            placeholder={rembourse ? "Ex. : remboursé le 07/11 via le tableau de bord Papi" : "Ex. : le client n'a payé qu'une fois"}
          />
        </label>
        {manquant && <Alerte>Le commentaire est obligatoire : expliquez ce qui a été fait (3 caractères au moins).</Alerte>}
      </div>
    </ModaleConfirmation>
  );
}
