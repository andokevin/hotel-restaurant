import type { Role } from "@hotel/commun";

export type NomService = "auth" | "hebergement" | "facturation" | "menage" | "stock" | "restaurant" | "comptabilite";

// PUBLIC : sans compte. CONNECTE : n'importe quel compte. Sinon : liste des rôles autorisés.
export type Acces = "PUBLIC" | "CONNECTE" | readonly Role[];

export type Regle = {
  methode: "get" | "post" | "patch" | "put" | "delete";
  chemin: string; // même syntaxe que les routes Express (":id")
  service: NomService;
  acces: Acces;
};

const RECEPTION = ["RECEPTIONNISTE", "ADMIN"] as const;
// Ceux qui voient les factures : caisse de la réception, du restaurant, et le comptable
const PERSONNEL_CAISSE = ["RECEPTIONNISTE", "RESTAURANT", "COMPTABLE", "ADMIN"] as const;

// LA table des droits de toute l'application.
// Refus par défaut : une route absente de cette liste répond 404, même si le service la connaît
// (c'est ce qui rend les routes /interne injoignables depuis l'extérieur).
export const REGLES: readonly Regle[] = [
  // --- auth ---
  { methode: "post", chemin: "/auth/inscription", service: "auth", acces: "PUBLIC" },
  { methode: "post", chemin: "/auth/connexion", service: "auth", acces: "PUBLIC" },
  { methode: "post", chemin: "/auth/rafraichir", service: "auth", acces: "PUBLIC" }, // prouvé par le cookie
  { methode: "post", chemin: "/auth/deconnexion", service: "auth", acces: "PUBLIC" },
  { methode: "get", chemin: "/auth/moi", service: "auth", acces: "CONNECTE" },
  { methode: "get", chemin: "/auth/utilisateurs", service: "auth", acces: ["ADMIN"] },
  { methode: "post", chemin: "/auth/utilisateurs", service: "auth", acces: ["ADMIN"] },
  { methode: "patch", chemin: "/auth/utilisateurs/:id", service: "auth", acces: ["ADMIN"] },

  // --- hebergement ---
  { methode: "get", chemin: "/categories", service: "hebergement", acces: "PUBLIC" },
  { methode: "get", chemin: "/categories/:id", service: "hebergement", acces: "PUBLIC" },
  { methode: "post", chemin: "/categories", service: "hebergement", acces: ["ADMIN"] },
  { methode: "get", chemin: "/chambres", service: "hebergement", acces: ["RECEPTIONNISTE", "FEMME_MENAGE", "ADMIN"] },
  { methode: "get", chemin: "/chambres/:id", service: "hebergement", acces: ["RECEPTIONNISTE", "FEMME_MENAGE", "ADMIN"] },
  { methode: "post", chemin: "/chambres", service: "hebergement", acces: ["ADMIN"] },
  { methode: "post", chemin: "/reservations", service: "hebergement", acces: ["CLIENT", ...RECEPTION] },
  { methode: "get", chemin: "/reservations", service: "hebergement", acces: RECEPTION },
  // ORDRE IMPORTANT : les chemins fixes AVANT "/reservations/:id".
  // La première règle qui correspond s'applique ; si ":id" venait d'abord, un CLIENT
  // atteindrait "/reservations/departs" en passant par la règle ":id" (ouverte aux clients).
  { methode: "get", chemin: "/reservations/mes-reservations", service: "hebergement", acces: ["CLIENT"] },
  { methode: "get", chemin: "/reservations/departs", service: "hebergement", acces: RECEPTION },
  // Un CLIENT n'obtient que SES réservations : hebergement vérifie l'appartenance (sinon 404).
  { methode: "get", chemin: "/reservations/:id", service: "hebergement", acces: ["CLIENT", ...RECEPTION] },
  { methode: "post", chemin: "/reservations/:id/annuler", service: "hebergement", acces: RECEPTION },
  { methode: "post", chemin: "/reservations/:id/check-in", service: "hebergement", acces: RECEPTION },
  { methode: "post", chemin: "/reservations/:id/check-out", service: "hebergement", acces: RECEPTION },

  // --- facturation ---
  // Demander un lien Papi : le client pour SA réservation, la réception pour un client au comptoir.
  { methode: "post", chemin: "/paiements", service: "facturation", acces: ["CLIENT", ...RECEPTION] },
  // Notification serveur à serveur de Papi : pas de JWT possible. Elle est authentifiée par le
  // jeton secret de son URL (vérifié par facturation) puis par le notificationToken (worker).
  { methode: "post", chemin: "/paiements/notification", service: "facturation", acces: "PUBLIC" },
  { methode: "get", chemin: "/paiements/:id", service: "facturation", acces: ["CLIENT", ...PERSONNEL_CAISSE] },
  { methode: "get", chemin: "/factures", service: "facturation", acces: PERSONNEL_CAISSE },
  { methode: "get", chemin: "/factures/mes-factures", service: "facturation", acces: ["CLIENT"] }, // avant ":id"
  { methode: "get", chemin: "/factures/:id", service: "facturation", acces: ["CLIENT", ...PERSONNEL_CAISSE] },
  { methode: "post", chemin: "/factures/:id/encaissements", service: "facturation", acces: ["RECEPTIONNISTE", "RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/factures/:id/cloturer", service: "facturation", acces: RECEPTION },

  // --- menage ---
  { methode: "get", chemin: "/taches", service: "menage", acces: ["FEMME_MENAGE", ...RECEPTION] },
  { methode: "post", chemin: "/taches/:id/demarrer", service: "menage", acces: ["FEMME_MENAGE"] },
  { methode: "post", chemin: "/taches/:id/terminer", service: "menage", acces: ["FEMME_MENAGE"] },

  // --- stock ---
  { methode: "get", chemin: "/articles", service: "stock", acces: ["FEMME_MENAGE", "RECEPTIONNISTE", "COMPTABLE", "ADMIN"] },
  { methode: "post", chemin: "/articles", service: "stock", acces: ["ADMIN"] },
  { methode: "get", chemin: "/articles/:id/mouvements", service: "stock", acces: ["COMPTABLE", "ADMIN"] },
  { methode: "post", chemin: "/articles/:id/mouvements", service: "stock", acces: ["COMPTABLE", "ADMIN"] },

  // --- restaurant (lanes Restaurant et Communication) ---
  { methode: "get", chemin: "/menus/publies", service: "restaurant", acces: "PUBLIC" },
  { methode: "get", chemin: "/menus", service: "restaurant", acces: ["RESTAURANT", "COMMUNICATION", "ADMIN"] },
  { methode: "post", chemin: "/menus", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/menus/:id/plats", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "patch", chemin: "/plats/:id", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/menus/:id/publier", service: "restaurant", acces: ["COMMUNICATION", "ADMIN"] },
  { methode: "post", chemin: "/menus/:id/depublier", service: "restaurant", acces: ["COMMUNICATION", "ADMIN"] },
  { methode: "get", chemin: "/menus/:id/texte-facebook", service: "restaurant", acces: ["COMMUNICATION", "ADMIN"] },
  { methode: "get", chemin: "/commandes", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/commandes", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/commandes/:id/statut", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/commandes/:id/imputer", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
  { methode: "post", chemin: "/commandes/:id/facturer", service: "restaurant", acces: ["RESTAURANT", "ADMIN"] },
];
