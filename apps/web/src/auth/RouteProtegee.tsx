import { Navigate, Outlet, useLocation } from "react-router";
import { Chargement } from "../components/ui";
import type { Role } from "../lib/types";
import { useAuth } from "./AuthContext";
import { ESPACE_DU_ROLE } from "./roles";

// Enveloppe les routes réservées à certains rôles.
// - pas connecté → page de connexion (en mémorisant la page demandée) ;
// - connecté avec un autre rôle → renvoyé vers son propre espace.
export function RouteProtegee({ roles }: { roles: readonly Role[] }) {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Chargement texte="Vérification de la session…" />;
  if (!utilisateur) {
    return <Navigate to="/connexion" replace state={{ depuis: location.pathname + location.search }} />;
  }
  if (!roles.includes(utilisateur.role)) {
    return <Navigate to={ESPACE_DU_ROLE[utilisateur.role]} replace />;
  }
  return <Outlet />;
}
