import type { TexteTraduit } from "./types";

// 125000 → "125 000 Ar"
export const ariary = (montant: number): string => montant.toLocaleString("fr-FR") + " Ar";

// "2026-10-01" ou date ISO complète → "01/10/2026"
export const dateCourte = (valeur: string | null | undefined): string => {
  if (!valeur) return "—";
  // Une date « calendrier » (AAAA-MM-JJ, éventuellement suivie de T00:00:00.000Z) est lue
  // telle quelle, sans conversion de fuseau horaire, pour éviter un décalage d'un jour.
  const calendrier = /^(\d{4}-\d{2}-\d{2})(T00:00:00(\.000)?Z)?$/.exec(valeur);
  const d = calendrier?.[1] ? new Date(calendrier[1] + "T00:00:00") : new Date(valeur);
  return d.toLocaleDateString("fr-FR");
};

// Date ISO → "01/10/2026 14:32"
export const dateHeure = (valeur: string | null | undefined): string => {
  if (!valeur) return "—";
  return new Date(valeur).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

// Date du jour au format AAAA-MM-JJ (heure locale, pas UTC).
export const aujourdhui = (): string => versAAAAMMJJ(new Date());

export const versAAAAMMJJ = (d: Date): string => {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
};

export const ajouterJours = (aaaammjj: string, jours: number): string => {
  const d = new Date(aaaammjj + "T00:00:00");
  d.setDate(d.getDate() + jours);
  return versAAAAMMJJ(d);
};

// Texte traduit ({ fr, mg, en }) ou simple chaîne → texte français.
export const texte = (valeur: TexteTraduit | string | null | undefined): string => {
  if (!valeur) return "";
  return typeof valeur === "string" ? valeur : valeur.fr;
};

// Libellés français des valeurs d'énumération renvoyées par l'API.
export const LIBELLES: Record<string, string> = {
  // Réservations
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
  // Chambres
  PROPRE: "Propre",
  SALE: "Sale",
  EN_NETTOYAGE: "En nettoyage",
  // Factures / paiements
  EMISE: "Émise",
  PAYEE: "Payée",
  CLOTUREE: "Clôturée",
  EN_ATTENTE: "En attente",
  REUSSI: "Réussi",
  ECHOUE: "Échoué",
  ANOMALIE: "Anomalie",
  // Tâches
  A_FAIRE: "À faire",
  QUOTIDIEN: "Quotidien",
  DEPART: "Départ",
  // Commandes
  RECUE: "Reçue",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  REMISE: "Remise",
  NON_PAYEE: "Non payée",
  IMPUTEE_CHAMBRE: "Imputée à la chambre",
  SUR_PLACE: "Sur place",
  A_EMPORTER: "À emporter",
  // Plats
  ENTREE: "Entrée",
  PLAT: "Plat",
  DESSERT: "Dessert",
  BOISSON: "Boisson",
  // Reversements
  A_REVERSER: "À reverser",
  REVERSE: "Reversé",
  // Rôles
  ADMIN: "Administrateur",
  RECEPTIONNISTE: "Réceptionniste",
  FEMME_MENAGE: "Femme de ménage",
  RESTAURANT: "Restaurant",
  COMPTABLE: "Comptable",
  COMMUNICATION: "Communication",
  CLIENT: "Client",
  // Canaux
  RECEPTION: "Réception",
  FACEBOOK: "Facebook",
  SITE_WEB: "Site web",
};

export const libelle = (code: string | null): string => (code === null ? "—" : (LIBELLES[code] ?? code));
