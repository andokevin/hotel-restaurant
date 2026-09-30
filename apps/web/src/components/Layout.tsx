import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { MENU_DU_ROLE } from "../auth/roles";
import { libelle } from "../lib/format";

// Gabarit commun : en-tête avec la navigation du rôle connecté, puis la page.
export function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const liens = utilisateur ? MENU_DU_ROLE[utilisateur.role] : [];

  const seDeconnecter = async () => {
    await deconnecter();
    navigate("/connexion");
  };

  const classeLien = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-800 text-white" : "text-emerald-50 hover:bg-emerald-800/60"}`;

  return (
    <div className="min-h-screen">
      <header className="bg-emerald-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Hôtel &amp; Restaurant
          </Link>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm md:hidden"
            onClick={() => setMenuOuvert((o) => !o)}
            aria-label="Ouvrir le menu"
          >
            ☰ Menu
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {liens.map((l) => (
              <NavLink key={l.vers} to={l.vers} className={classeLien}>
                {l.libelle}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {utilisateur ? (
              <>
                <span className="text-sm text-emerald-100">
                  {utilisateur.nom} · {libelle(utilisateur.role)}
                </span>
                <button type="button" onClick={() => void seDeconnecter()} className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/connexion" className="text-sm hover:underline">Connexion</Link>
                <Link to="/inscription" className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-emerald-900">Créer un compte</Link>
              </>
            )}
          </div>
        </div>
        {/* Menu mobile */}
        {menuOuvert && (
          <div className="space-y-1 border-t border-emerald-800 px-4 py-3 md:hidden" onClick={() => setMenuOuvert(false)}>
            {liens.map((l) => (
              <NavLink key={l.vers} to={l.vers} className={classeLien}>
                {l.libelle}
              </NavLink>
            ))}
            {utilisateur ? (
              <button type="button" onClick={() => void seDeconnecter()} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-800/60">
                Déconnexion ({utilisateur.nom})
              </button>
            ) : (
              <>
                <NavLink to="/connexion" className={classeLien}>Connexion</NavLink>
                <NavLink to="/inscription" className={classeLien}>Créer un compte</NavLink>
              </>
            )}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
