import type { Role } from "@hotel/commun";

export type NomService = "auth" | "hebergement";

// PUBLIC : sans compte. CONNECTE : n'importe quel compte. Sinon : liste des rôles autorisés.
export type Acces = "PUBLIC" | "CONNECTE" | readonly Role[];

export type Regle = {
  methode: "get" | "post" | "patch" | "put" | "delete";
  chemin: string; // même syntaxe que les routes Express (":id")
  service: NomService;
  acces: Acces;
};

const RECEPTION = ["RECEPTIONNISTE", "ADMIN"] as const;

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
  // Lecture réservée au personnel : un CLIENT ne verra « ses » réservations qu'en phase 3,
  // quand hebergement saura vérifier qu'elles lui appartiennent.
  { methode: "get", chemin: "/reservations", service: "hebergement", acces: RECEPTION },
  { methode: "get", chemin: "/reservations/:id", service: "hebergement", acces: RECEPTION },
];
