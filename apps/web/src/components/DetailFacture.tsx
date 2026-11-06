import { ariary, dateHeure, libelle } from "../lib/format";
import type { Facture, LigneFacture } from "../lib/types";
import { Badge } from "./ui";

// Ordre d'affichage : le séjour d'abord, groupe de nuitées par groupe (ordre), puis les consommations.
const RANG_ORIGINE: Record<LigneFacture["origine"], number> = { HEBERGEMENT: 0, RESTAURANT: 1 };
const trierLignes = (lignes: LigneFacture[]) =>
  [...lignes].sort((a, b) => RANG_ORIGINE[a.origine] - RANG_ORIGINE[b.origine] || (a.ordre ?? 0) - (b.ordre ?? 0));

// Le libellé d'un groupe de nuitées nomme sa saison : « STANDARD – Haute saison – 1 nuit(s) du … ».
const saisonDuLibelle = (l: LigneFacture): string | null =>
  l.origine === "HEBERGEMENT" ? (/^\S+ – (.+?) – \d+ nuit/.exec(l.libelle)?.[1] ?? null) : null;

// Contenu d'une facture : lignes, paiements et reste à payer. Les actions sont ajoutées par l'écran appelant.
export function DetailFacture({ facture }: { facture: Facture }) {
  const f = facture;
  const reste = f.montantTotal - f.montantPaye;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{f.numero}</span>
        <Badge code={f.statut} />
        <span className="text-slate-500">
          {f.clientNom} · émise le {dateHeure(f.emiseLe)}
          {f.clotureeLe && ` · clôturée le ${dateHeure(f.clotureeLe)}`}
        </span>
      </div>

      {/* Une liste plutôt qu'un tableau à 5 colonnes : lisible sur un téléphone de 360 px sans défilement horizontal. */}
      {f.lignes && f.lignes.length > 0 && (
        <ul aria-label="Lignes de la facture" className="divide-y divide-slate-100 border-y border-slate-200">
          {trierLignes(f.lignes).map((l, i) => {
            const saison = saisonDuLibelle(l);
            return (
              <li key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words">{l.libelle}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{l.origine === "HEBERGEMENT" ? "Hébergement" : "Restaurant"}</span>
                    <span>
                      {l.quantite} × {ariary(l.prixUnitaire)}
                    </span>
                    {saison && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">{saison}</span>}
                  </p>
                </div>
                <span className="font-medium whitespace-nowrap">{ariary(l.montant)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-slate-500">Total</dt>
        <dd className="text-right font-semibold">{ariary(f.montantTotal)}</dd>
        <dt className="text-slate-500">Déjà payé</dt>
        <dd className="text-right">{ariary(f.montantPaye)}</dd>
        <dt className="text-slate-500">Reste à payer</dt>
        <dd className={`text-right font-bold ${reste > 0 ? "text-red-700" : "text-emerald-700"}`}>{ariary(reste)}</dd>
      </dl>

      {f.paiements && f.paiements.length > 0 && (
        <div>
          <h4 className="mb-1 font-medium text-slate-700">Paiements</h4>
          <ul className="space-y-0.5">
            {f.paiements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{ariary(p.montant)}</span>
                <span className="text-slate-500">{libelle(p.methode)}</span>
                <Badge code={p.statut} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
