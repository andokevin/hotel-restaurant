import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alerte, Bouton, BoutonCopier, Carte, Chargement, Donnees, MessageErreur, TitrePage } from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import { ariary, texte } from "../../lib/format";
import { useCategories, useMenus } from "../../lib/requetes";
import type { Categorie, Menu } from "../../lib/types";

// Grille tarifaire en texte brut, prête à coller dans une publication.
const grilleTarifaire = (categories: Categorie[]): string =>
  ["🏨 Nos chambres — tarifs par nuit", ""]
    .concat(categories.map((c) => `• ${texte(c.libelle)} (${c.capacite} pers.) : ${ariary(c.tarifNuit)}`))
    .concat(["", "Réservation en ligne et paiement sécurisé par Papi."])
    .join("\n");

export function Communication() {
  const menus = useMenus();
  const categories = useCategories();

  return (
    <div className="space-y-6">
      <TitrePage>Communication</TitrePage>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Menus du restaurant</h2>
        <Donnees requete={menus} texteVide="Aucun menu créé par le restaurant.">
          {(liste) => (
            <div className="grid gap-4 md:grid-cols-2">
              {liste.map((m) => (
                <CarteMenuCommunication key={m.id} menu={m} />
              ))}
            </div>
          )}
        </Donnees>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Grille tarifaire des chambres</h2>
        <Donnees requete={categories} texteVide="Aucune catégorie de chambre.">
          {(liste) => {
            const texteGrille = grilleTarifaire(liste);
            return (
              <Carte>
                <pre className="mb-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{texteGrille}</pre>
                <BoutonCopier texte={texteGrille} libelleBouton="Copier la grille" />
              </Carte>
            );
          }}
        </Donnees>
      </section>
    </div>
  );
}

function CarteMenuCommunication({ menu }: { menu: Menu }) {
  const queryClient = useQueryClient();
  const [voirTexte, setVoirTexte] = useState(false);

  const publication = useMutation({
    mutationFn: (action: "publier" | "depublier") => api.post<Menu>(`/menus/${menu.id}/${action}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  return (
    <Carte
      titre={
        <span className="flex flex-wrap items-center gap-2">
          {texte(menu.nom)}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${menu.actif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            {menu.actif ? "Publié" : "Non publié"}
          </span>
        </span>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{menu.plats.length} plat(s)</p>
      <div className="flex flex-wrap gap-2">
        {menu.actif ? (
          <Bouton variante="secondaire" enCours={publication.isPending} onClick={() => publication.mutate("depublier")}>
            Dépublier
          </Bouton>
        ) : (
          <Bouton enCours={publication.isPending} onClick={() => publication.mutate("publier")}>
            Publier
          </Bouton>
        )}
        <Bouton variante="secondaire" onClick={() => setVoirTexte((v) => !v)}>
          {voirTexte ? "Masquer le texte Facebook" : "Texte Facebook"}
        </Bouton>
      </div>
      {publication.isError && (
        <div className="mt-2">
          <Alerte>{messageErreur(publication.error)}</Alerte>
        </div>
      )}
      {voirTexte && <TexteFacebook menuId={menu.id} />}
    </Carte>
  );
}

function TexteFacebook({ menuId }: { menuId: string }) {
  const requete = useQuery({
    queryKey: ["menus", "texte-facebook", menuId],
    queryFn: () => api.get<{ texte: string }>(`/menus/${menuId}/texte-facebook`),
  });
  if (requete.isPending) return <Chargement />;
  if (requete.isError) return <MessageErreur erreur={requete.error} />;
  return (
    <div className="mt-3 space-y-2">
      <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{requete.data.texte}</pre>
      <BoutonCopier texte={requete.data.texte} />
    </div>
  );
}
