// Petits composants d'interface réutilisés partout (Tailwind uniquement).
import type { UseQueryResult } from "@tanstack/react-query";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { messageErreur } from "../lib/api";
import { libelle } from "../lib/format";

// Classes communes des champs de formulaire.
export const classeInput =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100";

// Classes communes des tableaux.
export const classeTable = "min-w-full divide-y divide-slate-200 text-sm";
export const classeTh = "px-3 py-2 text-left font-semibold text-slate-600";
export const classeTd = "px-3 py-2 align-top";

export function TitrePage({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
      {actions}
    </div>
  );
}

export function Carte({ children, titre, className = "" }: { children: ReactNode; titre?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {titre && <h2 className="mb-3 text-lg font-semibold text-slate-900">{titre}</h2>}
      {children}
    </section>
  );
}

type Variante = "primaire" | "secondaire" | "danger" | "discret";
const CLASSES_VARIANTE: Record<Variante, string> = {
  primaire: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondaire: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  discret: "text-emerald-800 hover:bg-emerald-50",
};

type PropsBouton = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; enCours?: boolean };

export function Bouton({ variante = "primaire", enCours = false, className = "", children, disabled, ...reste }: PropsBouton) {
  return (
    <button
      type="button"
      {...reste}
      disabled={disabled || enCours}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${CLASSES_VARIANTE[variante]} ${className}`}
    >
      {enCours && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// Un libellé + un champ + son éventuel message d'erreur.
export function Champ({ label, erreur, children }: { label: string; erreur?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {erreur && <span className="block text-xs text-red-600">{erreur}</span>}
    </label>
  );
}

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      {texte}
    </div>
  );
}

export function Alerte({ type = "erreur", children }: { type?: "erreur" | "succes" | "info" | "attention"; children: ReactNode }) {
  const classes = {
    erreur: "border-red-200 bg-red-50 text-red-800",
    succes: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    attention: "border-amber-200 bg-amber-50 text-amber-900",
  }[type];
  return <div className={`rounded-md border px-3 py-2 text-sm ${classes}`}>{children}</div>;
}

export function MessageErreur({ erreur }: { erreur: unknown }) {
  if (!erreur) return null;
  return <Alerte type="erreur">{messageErreur(erreur)}</Alerte>;
}

export function Vide({ texte }: { texte: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{texte}</p>;
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

// Pastille colorée pour un statut.
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
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS[code] ?? "bg-slate-100 text-slate-700"}`}>
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
      {etat === "ok" ? "Copié !" : etat === "erreur" ? "Copie impossible" : libelleBouton}
    </Bouton>
  );
}

// Fenêtre modale très simple (fond grisé, bouton « Fermer » pour sortir).
export function Modale({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="mt-10 w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Fermer ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Tableau qui défile horizontalement sur petit écran.
export function TableDefilante({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">{children}</div>;
}
