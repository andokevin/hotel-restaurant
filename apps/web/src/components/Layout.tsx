import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { MENU_DU_ROLE } from "../auth/roles";
import { libelle } from "../lib/format";

// Gabarit commun : en-tête (marque + compte), barre de navigation du rôle connecté, puis la page.
export function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Le menu mobile se referme dès qu'on change de page.
  useEffect(() => setMenuOuvert(false), [pathname]);

  const liens = utilisateur ? MENU_DU_ROLE[utilisateur.role] : [];

  const seDeconnecter = async () => {
    await deconnecter();
    navigate("/connexion");
  };

  const classeOnglet = ({ isActive }: { isActive: boolean }) =>
    `relative flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-medium transition ${
      isActive
        ? "text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-terre-600"
        : "text-emerald-100 hover:text-white"
    }`;
  const classeLienMobile = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center rounded-lg px-3 text-base font-medium ${isActive ? "bg-white/15 text-white" : "text-emerald-50 hover:bg-white/10"}`;

  return (
    // Sur l'accueil (téléphone), une barre d'onglets est fixée en bas : on réserve sa hauteur pour ne pas cacher le pied de page.
    <div className={`flex min-h-screen flex-col ${pathname === "/" ? "pb-16 md:pb-0" : ""}`}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-emerald-900 focus:shadow"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-40 bg-emerald-900 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-terre-600 font-titre text-lg font-bold" aria-hidden>
              H
            </span>
            <span className="leading-tight">
              <span className="block font-titre text-lg font-bold tracking-tight">Hôtel &amp; Restaurant</span>
              <span className="block text-xs text-emerald-200">Antananarivo</span>
            </span>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            {utilisateur ? (
              <>
                <span className="text-right text-sm leading-tight">
                  <span className="block font-medium">{utilisateur.nom}</span>
                  <span className="block text-xs text-emerald-200">{libelle(utilisateur.role)}</span>
                </span>
                <button type="button" onClick={() => void seDeconnecter()} className="min-h-10 rounded-lg bg-white/10 px-3 text-sm hover:bg-white/20">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/connexion" className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-white/10">
                  Connexion
                </Link>
                <Link to="/inscription" className="flex min-h-10 items-center rounded-lg bg-terre-600 px-4 text-sm font-medium hover:bg-terre-700">
                  Créer un compte
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-white/10 md:hidden"
            onClick={() => setMenuOuvert((o) => !o)}
            aria-expanded={menuOuvert}
            aria-controls="menu-mobile"
          >
            <span aria-hidden>{menuOuvert ? "✕" : "☰"}</span>
            Menu
          </button>
        </div>

        {/* Navigation du rôle : barre d'onglets qui défile horizontalement si elle est trop longue (ADMIN) */}
        {liens.length > 0 && (
          <nav className="hidden border-t border-white/10 md:block" aria-label="Navigation principale">
            <div className="mx-auto flex max-w-6xl overflow-x-auto px-1">
              {liens.map((l) => (
                <NavLink key={l.vers} to={l.vers} className={classeOnglet}>
                  {l.libelle}
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        {/* Menu mobile */}
        {menuOuvert && (
          <nav id="menu-mobile" className="space-y-1 border-t border-white/10 px-4 py-3 md:hidden" aria-label="Navigation principale">
            {utilisateur && (
              <p className="px-3 pb-2 text-sm text-emerald-200">
                {utilisateur.nom} · {libelle(utilisateur.role)}
              </p>
            )}
            {liens.map((l) => (
              <NavLink key={l.vers} to={l.vers} className={classeLienMobile}>
                {l.libelle}
              </NavLink>
            ))}
            {utilisateur ? (
              <button
                type="button"
                onClick={() => void seDeconnecter()}
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-base text-emerald-50 hover:bg-white/10"
              >
                Déconnexion
              </button>
            ) : (
              <>
                <NavLink to="/connexion" className={classeLienMobile}>
                  Connexion
                </NavLink>
                <NavLink to="/inscription" className={classeLienMobile}>
                  Créer un compte
                </NavLink>
              </>
            )}
          </nav>
        )}
      </header>

      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-sable-200 bg-sable-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-sable-700">
          <span>Hôtel &amp; Restaurant · Antananarivo, Madagascar</span>
          <span>Paiement sécurisé Mobile Money avec Papi</span>
        </div>
      </footer>
    </div>
  );
}
