import { useEffect, useState } from "react";
import { ariary, dateCourte, dateHeure, personnes, texte } from "../lib/format";
import type { Reservation } from "../lib/types";
import { Badge } from "./ui";

// Minutes restantes avant l'expiration d'une réservation non payée (rafraîchi toutes les 15 s).
function useMinutesRestantes(expireLe: string | null | undefined): number | null {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!expireLe) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => clearInterval(minuteur);
  }, [expireLe]);
  if (!expireLe) return null;
  return Math.max(0, Math.ceil((new Date(expireLe).getTime() - maintenant) / 60_000));
}

export function Expiration({ expireLe }: { expireLe: string | null | undefined }) {
  const minutes = useMinutesRestantes(expireLe);
  if (minutes === null) return null;
  if (minutes === 0) return <span className="font-medium text-red-700">Délai de paiement dépassé</span>;
  return (
    <span className="font-medium text-amber-800">
      À payer avant {dateHeure(expireLe)} (encore {minutes} min)
    </span>
  );
}

// Récapitulatif d'une réservation : tous les montants viennent du serveur.
export function RecapReservation({ reservation }: { reservation: Reservation }) {
  const r = reservation;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{r.reference}</span>
        <Badge code={r.statut} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-slate-500">Arrivée</dt>
        <dd>{dateCourte(r.dateArrivee)}</dd>
        <dt className="text-slate-500">Départ</dt>
        <dd>{dateCourte(r.dateDepart)}</dd>
        <dt className="text-slate-500">Personnes</dt>
        <dd>{personnes(r)}</dd>
        {r.chambre && (
          <>
            <dt className="text-slate-500">Chambre</dt>
            <dd>
              n° {r.chambre.numero}
              {r.chambre.categorie && ` — ${texte(r.chambre.categorie.libelle)}`}
            </dd>
          </>
        )}
        <dt className="text-slate-500">Montant total</dt>
        <dd className="text-base font-bold text-emerald-800">{ariary(r.montantTotal)}</dd>
      </dl>
      {r.nuitees && r.nuitees.length > 0 && (
        <details className="rounded-md bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-slate-600">Détail des {r.nuitees.length} nuitée(s)</summary>
          <ul className="mt-2 space-y-0.5">
            {r.nuitees.map((n) => (
              <li key={n.nuit} className="flex justify-between">
                <span>Nuit du {dateCourte(n.nuit.slice(0, 10))}</span>
                <span>
                  {ariary(n.tarifApplique)}
                  {n.saison && <span className="ml-1 text-xs text-slate-500">({texte(n.saison.nom)})</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <span>Total</span>
            <span>{ariary(r.nuitees.reduce((somme, n) => somme + n.tarifApplique, 0))}</span>
          </div>
        </details>
      )}
      {r.statut === "EN_ATTENTE_PAIEMENT" && (
        <p>
          <Expiration expireLe={r.expireLe} />
        </p>
      )}
    </div>
  );
}
