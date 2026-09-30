import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alerte, Bouton, Carte, Champ, Donnees, TitrePage, classeInput } from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import { ariary, libelle, texte } from "../../lib/format";
import { useMenus } from "../../lib/requetes";
import type { CategoriePlat, Menu, Plat } from "../../lib/types";
import { entierPositif } from "../../lib/validation";

const CATEGORIES: CategoriePlat[] = ["ENTREE", "PLAT", "DESSERT", "BOISSON"];

export function MenusRestaurant() {
  const menus = useMenus();

  return (
    <div className="space-y-6">
      <TitrePage>Menus et plats</TitrePage>
      <Carte titre="Nouveau menu">
        <FormulaireMenu />
      </Carte>
      <Donnees requete={menus} texteVide="Aucun menu pour le moment : créez-en un ci-dessus.">
        {(liste) => (
          <div className="space-y-4">
            {liste.map((m) => (
              <CarteMenu key={m.id} menu={m} />
            ))}
          </div>
        )}
      </Donnees>
    </div>
  );
}

const schemaMenu = z.object({ nom: z.string().trim().min(2, "2 caractères minimum").max(100) });

function FormulaireMenu() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof schemaMenu>>({
    resolver: zodResolver(schemaMenu),
    defaultValues: { nom: "" },
  });
  const creation = useMutation({
    mutationFn: (nom: string) => api.post<Menu>("/menus", { nom: { fr: nom } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menus"] });
      reset();
    },
  });
  return (
    <form onSubmit={handleSubmit((d) => creation.mutate(d.nom))} className="flex flex-wrap items-end gap-2" noValidate>
      <div className="min-w-60 flex-1">
        <Champ label="Nom du menu" erreur={formState.errors.nom?.message}>
          <input className={classeInput} placeholder="Ex. Menu du midi" {...register("nom")} />
        </Champ>
      </div>
      <Bouton type="submit" enCours={creation.isPending}>
        Créer le menu
      </Bouton>
      {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
    </form>
  );
}

function CarteMenu({ menu }: { menu: Menu }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Carte
      titre={
        <span className="flex flex-wrap items-center gap-2">
          {texte(menu.nom)}
          {menu.actif !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${menu.actif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              {menu.actif ? "Publié" : "Non publié"}
            </span>
          )}
        </span>
      }
    >
      {menu.plats.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun plat dans ce menu.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {menu.plats.map((p) => (
            <LignePlat key={p.id} plat={p} />
          ))}
        </ul>
      )}
      <div className="mt-3">
        {ajout ? (
          <FormulairePlat menuId={menu.id} onTermine={() => setAjout(false)} />
        ) : (
          <Bouton variante="secondaire" onClick={() => setAjout(true)}>
            + Ajouter un plat
          </Bouton>
        )}
      </div>
    </Carte>
  );
}

// Un plat : disponibilité (bascule) et modification du prix.
function LignePlat({ plat }: { plat: Plat }) {
  const queryClient = useQueryClient();
  const [prix, setPrix] = useState(String(plat.prix));
  const modification = useMutation({
    mutationFn: (corps: { disponible?: boolean; prix?: number }) => api.patch<Plat>(`/plats/${plat.id}`, corps),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  const prixValide = /^\d+$/.test(prix) && Number(prix) > 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div>
        <span className={plat.disponible ? "font-medium" : "font-medium text-slate-400 line-through"}>{texte(plat.nom)}</span>
        <span className="ml-2 text-xs text-slate-500">{libelle(plat.categorie)}</span>
        <span className="block text-xs text-slate-500">Prix actuel : {ariary(plat.prix)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          step={1}
          className={`${classeInput} w-28`}
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          aria-label="Nouveau prix"
        />
        <Bouton
          variante="secondaire"
          className="px-2 py-1 text-xs"
          disabled={!prixValide || Number(prix) === plat.prix}
          enCours={modification.isPending}
          onClick={() => modification.mutate({ prix: Number(prix) })}
        >
          Changer le prix
        </Bouton>
        <Bouton
          variante={plat.disponible ? "secondaire" : "primaire"}
          className="px-2 py-1 text-xs"
          enCours={modification.isPending}
          onClick={() => modification.mutate({ disponible: !plat.disponible })}
        >
          {plat.disponible ? "Marquer épuisé" : "Remettre disponible"}
        </Bouton>
      </div>
      {modification.isError && (
        <div className="w-full">
          <Alerte>{messageErreur(modification.error)}</Alerte>
        </div>
      )}
    </li>
  );
}

const schemaPlat = z.object({
  nom: z.string().trim().min(2, "2 caractères minimum").max(100),
  description: z.string().trim().max(300),
  categorie: z.enum(["ENTREE", "PLAT", "DESSERT", "BOISSON"]),
  prix: entierPositif("Prix en Ariary (entier positif)"),
  tempsPreparationMin: entierPositif("Durée en minutes (entier positif)"),
});
type FormulairePlatDonnees = z.infer<typeof schemaPlat>;

function FormulairePlat({ menuId, onTermine }: { menuId: string; onTermine: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm<FormulairePlatDonnees>({
    resolver: zodResolver(schemaPlat),
    defaultValues: { nom: "", description: "", categorie: "PLAT", tempsPreparationMin: 15 },
  });
  const e = formState.errors;

  const creation = useMutation({
    mutationFn: (d: FormulairePlatDonnees) =>
      api.post<Plat>(`/menus/${menuId}/plats`, {
        nom: { fr: d.nom },
        ...(d.description ? { description: { fr: d.description } } : {}),
        categorie: d.categorie,
        prix: d.prix,
        tempsPreparationMin: d.tempsPreparationMin,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menus"] });
      onTermine();
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => creation.mutate(d))} className="space-y-3 rounded-md bg-slate-50 p-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Nom du plat" erreur={e.nom?.message}>
          <input className={classeInput} {...register("nom")} />
        </Champ>
        <Champ label="Catégorie" erreur={e.categorie?.message}>
          <select className={classeInput} {...register("categorie")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {libelle(c)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Prix (Ar)" erreur={e.prix?.message}>
          <input type="number" min={1} step={1} className={classeInput} {...register("prix", { valueAsNumber: true })} />
        </Champ>
        <Champ label="Temps de préparation (min)" erreur={e.tempsPreparationMin?.message}>
          <input type="number" min={1} step={1} className={classeInput} {...register("tempsPreparationMin", { valueAsNumber: true })} />
        </Champ>
      </div>
      <Champ label="Description (facultatif)" erreur={e.description?.message}>
        <input className={classeInput} {...register("description")} />
      </Champ>
      {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
      <div className="flex gap-2">
        <Bouton type="submit" enCours={creation.isPending}>
          Ajouter le plat
        </Bouton>
        <Bouton variante="secondaire" onClick={onTermine}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
