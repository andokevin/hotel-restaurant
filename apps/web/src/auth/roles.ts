import type { Role } from "../lib/types";

// Page d'accueil de chaque rôle après la connexion.
export const ESPACE_DU_ROLE: Record<Role, string> = {
  CLIENT: "/client/reserver",
  RECEPTIONNISTE: "/reception/reservations",
  FEMME_MENAGE: "/menage/taches",
  RESTAURANT: "/restaurant/commande",
  COMMUNICATION: "/communication",
  COMPTABLE: "/comptable/tableaux",
  ADMIN: "/admin/comptes",
};

export type LienMenu = { vers: string; libelle: string };

// Menu de navigation affiché dans l'en-tête selon le rôle.
// L'ADMIN voit en plus les espaces métier (il a les droits sur la plupart des routes).
export const MENU_DU_ROLE: Record<Role, LienMenu[]> = {
  CLIENT: [
    { vers: "/client/reserver", libelle: "Réserver" },
    { vers: "/client/reservations", libelle: "Mes réservations" },
    { vers: "/client/factures", libelle: "Mes factures" },
  ],
  RECEPTIONNISTE: [
    { vers: "/reception/reservations", libelle: "Réservations" },
    { vers: "/reception/nouvelle", libelle: "Nouvelle réservation" },
    { vers: "/reception/departs", libelle: "Départs du jour" },
    { vers: "/reception/factures", libelle: "Factures" },
    { vers: "/reception/chambres", libelle: "Chambres" },
    { vers: "/menage/taches", libelle: "Ménage" },
  ],
  FEMME_MENAGE: [{ vers: "/menage/taches", libelle: "Tâches du jour" }],
  RESTAURANT: [
    { vers: "/restaurant/commande", libelle: "Prise de commande" },
    { vers: "/restaurant/commandes", libelle: "Suivi des commandes" },
    { vers: "/restaurant/menus", libelle: "Menus et plats" },
  ],
  COMMUNICATION: [{ vers: "/communication", libelle: "Menus et tarifs" }],
  COMPTABLE: [
    { vers: "/comptable/tableaux", libelle: "Tableaux journaliers" },
    { vers: "/comptable/reversements", libelle: "Reversements" },
    { vers: "/comptable/factures", libelle: "Copies de factures" },
    { vers: "/comptable/stock", libelle: "Stock" },
  ],
  ADMIN: [
    { vers: "/admin/comptes", libelle: "Comptes" },
    { vers: "/admin/categories", libelle: "Catégories" },
    { vers: "/admin/chambres", libelle: "Chambres" },
    { vers: "/admin/articles", libelle: "Articles" },
    { vers: "/reception/reservations", libelle: "Réception" },
    { vers: "/comptable/tableaux", libelle: "Comptabilité" },
    { vers: "/restaurant/menus", libelle: "Menus" },
    { vers: "/communication", libelle: "Communication" },
  ],
};
