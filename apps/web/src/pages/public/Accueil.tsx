import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { ESPACE_DU_ROLE } from "../../auth/roles";
import { Carte, Donnees } from "../../components/ui";
import { ariary, libelle, texte } from "../../lib/format";
import { useCategories, useMenusPublies } from "../../lib/requetes";
import type { CategoriePlat, Plat } from "../../lib/types";

const ORDRE_PLATS: CategoriePlat[] = ["ENTREE", "PLAT", "DESSERT", "BOISSON"];

export function Accueil() {
  const { utilisateur } = useAuth();
  const categories = useCategories();
  const menus = useMenusPublies();

  const lienReserver = utilisateur ? ESPACE_DU_ROLE[utilisateur.role] : "/connexion";

  return (
    <div className="space-y-10">
      <section className="rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 px-6 py-10 text-white">
        <h1 className="text-3xl font-bold">Bienvenue à l'Hôtel &amp; Restaurant</h1>
        <p className="mt-2 max-w-2xl text-emerald-100">
          Réservez votre chambre en ligne et payez en toute sécurité avec Papi (Mobile Money).
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={lienReserver} className="rounded-md bg-white px-4 py-2 font-medium text-emerald-900">
            {utilisateur ? "Aller à mon espace" : "Réserver une chambre"}
          </Link>
          {!utilisateur && (
            <Link to="/inscription" className="rounded-md border border-white/40 px-4 py-2 font-medium">
              Créer un compte
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">Nos chambres</h2>
        <Donnees requete={categories} texteVide="Aucune catégorie de chambre pour le moment.">
          {(liste) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((c) => (
                <Carte key={c.id} titre={texte(c.libelle)}>
                  {c.description && <p className="mb-3 text-sm text-slate-600">{texte(c.description)}</p>}
                  <p className="text-sm text-slate-600">Jusqu'à {c.capacite} personne(s)</p>
                  <p className="mt-2 text-xl font-bold text-emerald-800">
                    {ariary(c.tarifNuit)} <span className="text-sm font-normal text-slate-500">/ nuit</span>
                  </p>
                </Carte>
              ))}
            </div>
          )}
        </Donnees>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">Le restaurant</h2>
        <Donnees requete={menus} texteVide="Aucun menu publié pour le moment.">
          {(liste) => (
            <div className="grid gap-4 md:grid-cols-2">
              {liste.map((m) => (
                <Carte key={m.id} titre={texte(m.nom)}>
                  <ListePlats plats={m.plats} />
                </Carte>
              ))}
            </div>
          )}
        </Donnees>
      </section>
    </div>
  );
}

function ListePlats({ plats }: { plats: Plat[] }) {
  if (plats.length === 0) return <p className="text-sm text-slate-500">Aucun plat.</p>;
  return (
    <div className="space-y-4">
      {ORDRE_PLATS.map((cat) => {
        const duType = plats.filter((p) => p.categorie === cat);
        if (duType.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{libelle(cat)}</h3>
            <ul className="divide-y divide-slate-100">
              {duType.map((p) => (
                <li key={p.id} className={`flex justify-between gap-3 py-1.5 text-sm ${p.disponible ? "" : "text-slate-400 line-through"}`}>
                  <span>
                    {texte(p.nom)}
                    {p.description && <span className="block text-xs text-slate-500">{texte(p.description)}</span>}
                  </span>
                  <span className="whitespace-nowrap font-medium">{ariary(p.prix)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
