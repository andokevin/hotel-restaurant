// L'hôtel est à Madagascar (UTC+3). Le serveur, lui, peut tourner en UTC :
// on ne se fie donc jamais au fuseau de la machine pour dire « quel jour on est ».
const FUSEAU = "Indian/Antananarivo";

// "2026-09-30" — le format en-CA donne directement AAAA-MM-JJ.
export const aujourdhuiMadagascar = (maintenant = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU }).format(maintenant);

export const anneeMadagascar = (maintenant = new Date()): number =>
  Number(aujourdhuiMadagascar(maintenant).slice(0, 4));

// Une colonne DATE revient de Prisma comme un Date à minuit UTC : on la remet en "AAAA-MM-JJ".
export const enTexte = (d: Date): string => d.toISOString().slice(0, 10);
