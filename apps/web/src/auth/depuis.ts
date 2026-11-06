// Page d'où l'on venait, posée dans location.state par RouteProtegee (ex. "/client/reserver?categorie=STANDARD").
// Transmise de la connexion à l'inscription (et inversement) pour ne pas perdre la chambre choisie.
// Seuls les chemins INTERNES sont acceptés : "//autre-site" ou "https://…" seraient une redirection ouverte.
export const lireDepuis = (etat: unknown): string | null => {
  if (typeof etat !== "object" || etat === null || !("depuis" in etat) || typeof etat.depuis !== "string") return null;
  const depuis = etat.depuis;
  return depuis.startsWith("/") && !depuis.startsWith("//") && !depuis.startsWith("/\\") ? depuis : null;
};
