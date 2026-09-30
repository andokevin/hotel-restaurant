import { ariary, dateHeure, libelle } from "../lib/format";
import type { Facture } from "../lib/types";
import { Badge, classeTd, classeTh } from "./ui";

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

      {f.lignes && f.lignes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={classeTh}>Libellé</th>
                <th className={classeTh}>Origine</th>
                <th className={`${classeTh} text-right`}>Qté</th>
                <th className={`${classeTh} text-right`}>Prix unitaire</th>
                <th className={`${classeTh} text-right`}>Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.lignes.map((l, i) => (
                <tr key={i}>
                  <td className={classeTd}>{l.libelle}</td>
                  <td className={classeTd}>{l.origine === "HEBERGEMENT" ? "Hébergement" : "Restaurant"}</td>
                  <td className={`${classeTd} text-right`}>{l.quantite}</td>
                  <td className={`${classeTd} text-right`}>{ariary(l.prixUnitaire)}</td>
                  <td className={`${classeTd} text-right`}>{ariary(l.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
