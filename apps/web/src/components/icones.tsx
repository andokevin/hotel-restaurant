// Petites icônes SVG (trait 2 px, couleur = currentColor), sans dépendance externe.
// Décoratives par défaut (aria-hidden) : le texte voisin porte le sens.
import type { ReactNode } from "react";

function Icone({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IconeCalendrier = (p: P) => (
  <Icone {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icone>
);
export const IconePersonne = (p: P) => (
  <Icone {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icone>
);
export const IconePersonnes = (p: P) => (
  <Icone {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 4 6.5" />
  </Icone>
);
export const IconeValide = (p: P) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 3 3 5-6" />
  </Icone>
);
export const IconeTelephone = (p: P) => (
  <Icone {...p}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M11 18h2" />
  </Icone>
);
export const IconeBouclier = (p: P) => (
  <Icone {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icone>
);
export const IconeLit = (p: P) => (
  <Icone {...p}>
    <path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" />
    <circle cx="7" cy="11" r="2" />
  </Icone>
);
export const IconeCouverts = (p: P) => (
  <Icone {...p}>
    <path d="M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 22V2c-2.5 1-4 3.5-4 7v4h4" />
  </Icone>
);
export const IconeLieu = (p: P) => (
  <Icone {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icone>
);
export const IconeListe = (p: P) => (
  <Icone {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icone>
);
