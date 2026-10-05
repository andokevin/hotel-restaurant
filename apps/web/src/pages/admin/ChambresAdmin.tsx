import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  Donnees,
  TableDefilante,
  TitrePage,
  classeInput,
  classeTable,
  classeTd,
  classeTh,
} from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import { texte } from "../../lib/format";
import { useCategories, useChambres } from "../../lib/requetes";
import type { Chambre } from "../../lib/types";
import { entierPositifOuNul } from "../../lib/validation";

const schema = z.object({
  numero: z.string().trim().min(1, "Numéro requis").max(10),
  etage: entierPositifOuNul("Étage entier (0 = rez-de-chaussée)"),
  categorieId: z.string().min(1, "Choisissez une catégorie"),
});
type Formulaire = z.infer<typeof schema>;

export function ChambresAdmin() {
  const chambres = useChambres();
  const categories = useCategories();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: { numero: "", etage: 1, categorieId: "" },
  });
  const e = formState.errors;

  const creation = useMutation({
    mutationFn: (d: Formulaire) => api.post<Chambre>("/chambres", d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chambres"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      reset();
    },
  });

  return (
    <div className="space-y-6">
      <TitrePage>Chambres</TitrePage>
      <Carte titre="Nouvelle chambre">
        <form onSubmit={handleSubmit((d) => creation.mutate(d))} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Numéro" erreur={e.numero?.message}>
              <input className={classeInput} placeholder="101" {...register("numero")} />
            </Champ>
            <Champ label="Étage" erreur={e.etage?.message}>
              <input type="number" min={0} step={1} className={classeInput} {...register("etage", { valueAsNumber: true })} />
            </Champ>
            <Champ label="Catégorie" erreur={e.categorieId?.message}>
              <select className={classeInput} {...register("categorieId")}>
                <option value="">— Choisir —</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {texte(c.libelle)}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          {categories.isError && <Alerte>{messageErreur(categories.error)}</Alerte>}
          {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
          <Bouton type="submit" enCours={creation.isPending}>
            Créer la chambre
          </Bouton>
        </form>
      </Carte>

      <Donnees requete={chambres} texteVide="Aucune chambre.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Numéro</th>
                  <th className={classeTh}>Étage</th>
                  <th className={classeTh}>Catégorie</th>
                  <th className={classeTh}>Ménage</th>
                  <th className={classeTh}>Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...liste]
                  .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }))
                  .map((c) => (
                    <tr key={c.id}>
                      <td className={`${classeTd} font-semibold`}>{c.numero}</td>
                      <td className={classeTd}>{c.etage}</td>
                      <td className={classeTd}>{c.categorie ? texte(c.categorie.libelle) : "—"}</td>
                      <td className={classeTd}>
                        <Badge code={c.etatMenage} />
                      </td>
                      <td className={classeTd}>{c.horsService ? <span className="text-red-700">Hors service</span> : "En service"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>
    </div>
  );
}
