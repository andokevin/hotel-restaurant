// Petits composants d'interface réutilisés partout (Tailwind uniquement).
// Jetons de design : voir index.css (émeraude = marque, sable = fonds, terre cuite = accent).
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { messageErreur } from "../lib/api";
import { libelle } from "../lib/format";

// Classes communes des champs de formulaire.
// Hauteur 44 px (cible tactile) et texte 16 px sur téléphone : en dessous, iOS zoome sur le champ.
export const classeInput =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm transition sm:text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-slate-100";

// Classes communes des tableaux.
export const classeTable = "min-w-full divide-y divide-slate-200 text-sm";
export const classeTh = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
export const classeTd = "px-3 py-3 align-top";

export function TitrePage({ children, actions, sousTitre }: { children: ReactNode; actions?: ReactNode; sousTitre?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{children}</h1>
        {sousTitre && <p className="mt-1 text-sm text-slate-600">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Carte({ children, titre, className = "" }: { children: ReactNode; titre?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-sable-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {titre && <h2 className="mb-3 text-lg font-semibold text-slate-900">{titre}</h2>}
      {children}
    </section>
  );
}

type Variante = "primaire" | "accent" | "secondaire" | "danger" | "discret" | "discretDanger";
const CLASSES_VARIANTE: Record<Variante, string> = {
  primaire: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
  accent: "bg-terre-600 text-white shadow-sm hover:bg-terre-700",
  secondaire: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  discret: "text-emerald-800 hover:bg-emerald-50",
  discretDanger: "text-red-700 hover:bg-red-50",
};

// Tailles : « normal » = 44 px (pouce), « petit » = 40 px (tableaux), « icone » = carré de 40 px.
type Taille = "normal" | "petit" | "icone";
const CLASSES_TAILLE: Record<Taille, string> = {
  normal: "min-h-11 px-4 text-sm",
  petit: "min-h-10 px-3 text-sm",
  icone: "h-10 w-10 text-lg",
};

// Classes d'un bouton, réutilisables sur un <Link> pour qu'il ressemble à un bouton.
export const classeBouton = (variante: Variante = "primaire", taille: Taille = "normal") =>
  `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${CLASSES_VARIANTE[variante]} ${CLASSES_TAILLE[taille]}`;

type PropsBouton = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; taille?: Taille; enCours?: boolean };

export function Bouton({ variante = "primaire", taille = "normal", enCours = false, className = "", children, disabled, ...reste }: PropsBouton) {
  return (
    <button
      type="button"
      {...reste}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      className={`${classeBouton(variante, taille)} ${className}`}
    >
      {enCours && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

// Un libellé + un champ + son éventuel message d'erreur.
export function Champ({ label, erreur, aide, children }: { label: string; erreur?: string; aide?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {aide && !erreur && <span className="block text-xs text-slate-500">{aide}</span>}
      {erreur && (
        <span className="block text-xs font-medium text-red-700" role="alert">
          {erreur}
        </span>
      )}
    </label>
  );
}

// Champ de recherche avec loupe et bouton d'effacement.
export function ChampRecherche({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        className={`${classeInput} pl-9 pr-10`}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {valeur && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-1 my-auto flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Filtres rapides en « pastilles » (un seul actif à la fois). Le nombre d'éléments est affiché à côté.
export function Pastilles<T extends string>({
  options,
  valeur,
  onChange,
  label,
}: {
  options: { valeur: T; libelle: string; nombre?: number }[];
  valeur: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(o.valeur)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
              actif ? "border-emerald-700 bg-emerald-700 text-white" : "border-sable-300 bg-white text-slate-700 hover:border-emerald-600"
            }`}
          >
            {o.libelle}
            {o.nombre !== undefined && (
              <span className={`rounded-full px-2 text-xs ${actif ? "bg-white/20" : "bg-sable-100 text-sable-700"}`}>{o.nombre}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" aria-hidden />
      {texte}
    </div>
  );
}

export function Alerte({ type = "erreur", children }: { type?: "erreur" | "succes" | "info" | "attention"; children: ReactNode }) {
  const { classes, icone } = {
    erreur: { classes: "border-red-200 bg-red-50 text-red-800", icone: "⚠" },
    succes: { classes: "border-emerald-200 bg-emerald-50 text-emerald-800", icone: "✓" },
    info: { classes: "border-sky-200 bg-sky-50 text-sky-800", icone: "ℹ" },
    attention: { classes: "border-amber-200 bg-amber-50 text-amber-900", icone: "!" },
  }[type];
  return (
    <div className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${classes}`} role={type === "erreur" ? "alert" : "status"}>
      <span aria-hidden className="font-bold">
        {icone}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function MessageErreur({ erreur }: { erreur: unknown }) {
  if (!erreur) return null;
  return <Alerte type="erreur">{messageErreur(erreur)}</Alerte>;
}

export function Vide({ texte, action }: { texte: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-sable-300 bg-white/60 px-4 py-10 text-center">
      <p className="text-sm text-slate-500">{texte}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Affiche le bon état d'une requête TanStack Query : chargement, erreur, vide, ou les données.
export function Donnees<T>({
  requete,
  children,
  estVide,
  texteVide = "Aucun élément.",
}: {
  requete: UseQueryResult<T>;
  children: (donnees: T) => ReactNode;
  estVide?: (donnees: T) => boolean;
  texteVide?: string;
}) {
  if (requete.isPending) return <Chargement />;
  if (requete.isError) return <MessageErreur erreur={requete.error} />;
  const donnees = requete.data;
  const vide = estVide ? estVide(donnees) : Array.isArray(donnees) && donnees.length === 0;
  if (vide) return <Vide texte={texteVide} />;
  return <>{children(donnees)}</>;
}

// Pastille colorée pour un statut (point de couleur + texte : l'information ne repose pas sur la couleur seule).
const COULEURS: Record<string, string> = {
  EN_ATTENTE_PAIEMENT: "bg-amber-100 text-amber-800",
  CONFIRMEE: "bg-sky-100 text-sky-800",
  EN_COURS: "bg-indigo-100 text-indigo-800",
  TERMINEE: "bg-slate-200 text-slate-700",
  ANNULEE: "bg-red-100 text-red-700",
  PROPRE: "bg-emerald-100 text-emerald-800",
  SALE: "bg-red-100 text-red-700",
  EN_NETTOYAGE: "bg-amber-100 text-amber-800",
  EMISE: "bg-amber-100 text-amber-800",
  PAYEE: "bg-emerald-100 text-emerald-800",
  CLOTUREE: "bg-slate-200 text-slate-700",
  EN_ATTENTE: "bg-amber-100 text-amber-800",
  REUSSI: "bg-emerald-100 text-emerald-800",
  ECHOUE: "bg-red-100 text-red-700",
  ANOMALIE: "bg-red-100 text-red-700",
  A_FAIRE: "bg-amber-100 text-amber-800",
  RECUE: "bg-sky-100 text-sky-800",
  EN_PREPARATION: "bg-amber-100 text-amber-800",
  PRETE: "bg-emerald-100 text-emerald-800",
  REMISE: "bg-slate-200 text-slate-700",
  NON_PAYEE: "bg-red-100 text-red-700",
  IMPUTEE_CHAMBRE: "bg-indigo-100 text-indigo-800",
  A_REVERSER: "bg-amber-100 text-amber-800",
  REVERSE: "bg-emerald-100 text-emerald-800",
};

export function Badge({ code }: { code: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${COULEURS[code] ?? "bg-slate-100 text-slate-700"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {libelle(code)}
    </span>
  );
}

// Copie un texte dans le presse-papiers et affiche « Copié ! » un instant.
export function BoutonCopier({ texte, libelleBouton = "Copier" }: { texte: string; libelleBouton?: string }) {
  const [etat, setEtat] = useState<"" | "ok" | "erreur">("");
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("ok");
    } catch {
      setEtat("erreur");
    }
    setTimeout(() => setEtat(""), 2000);
  };
  return (
    <Bouton variante="secondaire" onClick={() => void copier()}>
      <span aria-live="polite">{etat === "ok" ? "Copié !" : etat === "erreur" ? "Copie impossible" : libelleBouton}</span>
    </Bouton>
  );
}

// Fenêtre modale : Échap ou clic sur le fond pour fermer, focus placé dedans, page bloquée derrière.
// Sur téléphone elle s'ouvre en « feuille » collée en bas de l'écran (plus facile à atteindre au pouce).
export function Modale({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    boite.current?.focus();
    const debordement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("keydown", touche);
      document.body.style.overflow = debordement;
      precedent?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-start sm:overflow-y-auto sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFermer()}
    >
      <div
        ref={boite}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl focus:outline-none sm:mt-10 sm:max-h-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={idTitre} className="text-lg font-semibold text-slate-900">
            {titre}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Confirmation d'une action importante (remplace window.confirm : lisible, accessible, au style de l'application).
// Le bouton « Revenir » est à gauche et le bouton d'action affiche ce qu'il fait réellement.
export function ModaleConfirmation({
  titre,
  children,
  libelleConfirmer,
  variante = "primaire",
  enCours = false,
  erreur,
  onConfirmer,
  onAnnuler,
}: {
  titre: string;
  children: ReactNode;
  libelleConfirmer: string;
  variante?: "primaire" | "danger";
  enCours?: boolean;
  erreur?: unknown;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  return (
    <Modale titre={titre} onFermer={onAnnuler}>
      <div className="space-y-4">
        <div className="text-sm text-slate-700">{children}</div>
        <MessageErreur erreur={erreur} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onAnnuler} disabled={enCours}>
            Revenir
          </Bouton>
          <Bouton variante={variante} enCours={enCours} onClick={onConfirmer}>
            {libelleConfirmer}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

// Tableau qui défile horizontalement sur petit écran.
export function TableDefilante({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-sable-200 bg-white shadow-sm">{children}</div>;
}
