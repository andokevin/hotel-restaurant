// Petit client HTTP de l'application.
//
// - Toutes les URLs passent par la gateway, sous /api (proxy Vite en développement).
// - Le jeton d'accès (JWT) est gardé EN MÉMOIRE uniquement (jamais dans localStorage) :
//   un script injecté ne peut pas le retrouver après un rechargement.
// - La session longue est un cookie httpOnly posé par /api/auth ; il sert à obtenir
//   un nouveau jeton via POST /api/auth/rafraichir.
// - Sur une réponse 401, on fait UN SEUL rafraîchissement partagé puis on rejoue la requête.

import type { ReponseRafraichir } from "./types";

const PREFIXE = "/api";

// ---------------------------------------------------------------------------
// Erreur typée, affichable telle quelle dans l'interface
// ---------------------------------------------------------------------------

export type DetailErreur = { champ: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: DetailErreur[];

  constructor(status: number, code: string, message: string, details: DetailErreur[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Transforme n'importe quelle erreur en message lisible pour l'utilisateur.
export const messageErreur = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.details.length === 0) return err.message;
    return err.message + " — " + err.details.map((d) => `${d.champ} : ${d.message}`).join(" ; ");
  }
  if (err instanceof Error) return err.message;
  return "Erreur inattendue";
};

// Lecture prudente du corps d'erreur { code, message, details? } (le corps peut être absent ou non JSON).
const lireErreur = async (res: Response): Promise<ApiError> => {
  let corps: unknown = null;
  try {
    corps = await res.json();
  } catch {
    // pas de JSON : on garde un message générique
  }
  if (typeof corps === "object" && corps !== null) {
    const { code, message, details } = corps as { code?: unknown; message?: unknown; details?: unknown };
    const liste: DetailErreur[] = Array.isArray(details)
      ? details.filter(
          (d): d is DetailErreur =>
            typeof d === "object" && d !== null && typeof d.champ === "string" && typeof d.message === "string",
        )
      : [];
    return new ApiError(
      res.status,
      typeof code === "string" ? code : "ERREUR",
      typeof message === "string" ? message : `Erreur ${res.status}`,
      liste,
    );
  }
  return new ApiError(res.status, "ERREUR", `Erreur ${res.status}`);
};

// ---------------------------------------------------------------------------
// Jeton d'accès en mémoire
// ---------------------------------------------------------------------------

let jetonAcces: string | null = null;

export const definirJeton = (jeton: string | null): void => {
  jetonAcces = jeton;
};

// Appelé quand la session est définitivement perdue (le contexte d'auth s'y abonne
// pour vider l'utilisateur et renvoyer vers la page de connexion).
let surSessionExpiree: () => void = () => {};
export const quandSessionExpiree = (rappel: () => void): void => {
  surSessionExpiree = rappel;
};

// ---------------------------------------------------------------------------
// Rafraîchissement unique partagé
// ---------------------------------------------------------------------------

// Si plusieurs requêtes reçoivent un 401 en même temps, elles attendent toutes
// CETTE promesse : un seul appel à /auth/rafraichir part réellement.
let rafraichissementEnCours: Promise<boolean> | null = null;

const appelerRafraichir = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${PREFIXE}/auth/rafraichir`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      definirJeton(null);
      return false;
    }
    const data = (await res.json()) as ReponseRafraichir;
    definirJeton(data.jetonAcces);
    return true;
  } catch {
    definirJeton(null);
    return false;
  }
};

// Renvoie true si un nouveau jeton a été obtenu.
export const rafraichirSession = (): Promise<boolean> => {
  if (!rafraichissementEnCours) {
    // Entre plusieurs ONGLETS, on utilise un verrou du navigateur (Web Locks) quand il existe :
    // le serveur fait tourner le cookie de session et révoque tout en cas de réutilisation,
    // donc deux onglets ne doivent pas envoyer le même ancien cookie en même temps.
    const tache: Promise<boolean> =
      typeof navigator !== "undefined" && "locks" in navigator
        ? navigator.locks.request("hotel-rafraichir-session", appelerRafraichir)
        : appelerRafraichir();
    rafraichissementEnCours = tache.finally(() => {
      rafraichissementEnCours = null;
    });
  }
  return rafraichissementEnCours;
};

// ---------------------------------------------------------------------------
// Requête générique
// ---------------------------------------------------------------------------

type Options = {
  corps?: unknown;
  entetes?: Record<string, string>;
};

// Routes pour lesquelles un 401 ne doit PAS déclencher de rafraîchissement
// (sinon boucle, ou « identifiants invalides » transformé en déconnexion).
const SANS_REJEU = ["/auth/connexion", "/auth/rafraichir", "/auth/inscription", "/auth/deconnexion"];

const envoyer = (methode: string, chemin: string, options: Options): Promise<Response> => {
  const entetes: Record<string, string> = { ...options.entetes };
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";
  if (jetonAcces) entetes["Authorization"] = `Bearer ${jetonAcces}`;
  return fetch(PREFIXE + chemin, {
    method: methode,
    headers: entetes,
    credentials: "include",
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });
};

export async function requete<T>(methode: string, chemin: string, options: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await envoyer(methode, chemin, options);
    if (res.status === 401 && !SANS_REJEU.includes(chemin)) {
      const ok = await rafraichirSession();
      if (!ok) {
        surSessionExpiree();
        throw new ApiError(401, "SESSION_EXPIREE", "Votre session a expiré, veuillez vous reconnecter.");
      }
      res = await envoyer(methode, chemin, options); // on rejoue une seule fois
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "RESEAU", "Impossible de joindre le serveur. Vérifiez votre connexion.");
  }

  if (!res.ok) throw await lireErreur(res);
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json();
  return data as T;
}

// Raccourcis lisibles dans les composants.
export const api = {
  get: <T>(chemin: string) => requete<T>("GET", chemin),
  post: <T>(chemin: string, corps: unknown = {}, entetes?: Record<string, string>) =>
    requete<T>("POST", chemin, { corps, entetes }),
  patch: <T>(chemin: string, corps: unknown) => requete<T>("PATCH", chemin, { corps }),
};

// Construit une chaîne de requête en ignorant les valeurs vides.
export const qs = (params: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur) p.set(cle, valeur);
  }
  const s = p.toString();
  return s ? "?" + s : "";
};
