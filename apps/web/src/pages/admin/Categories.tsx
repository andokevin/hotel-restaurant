import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alerte,
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
import { ariary, texte } from "../../lib/format";
import { useCategories } from "../../lib/requetes";
import type { Categorie } from "../../lib/types";
import { entierPositif } from "../../lib/validation";

const schema = z.object({
  code: z.enum(["STANDARD", "SUITE_SENIOR", "SUITE_PRESTIGE"]),
  libelle: z.string().trim().min(2, "2 caractères minimum").max(100),
  capacite: entierPositif("Capacité entière positive"),
  tarifNuit: entierPositif("Tarif en Ariary (entier positif)"),
});
type Formulaire = z.infer<typeof schema>;

export function Categories() {
  const categories = useCategories();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: { code: "STANDARD", libelle: "", capacite: 2 },
  });
  const e = formState.errors;

  const creation = useMutation({
    mutationFn: (d: Formulaire) =>
      api.post<Categorie>("/categories", { code: d.code, libelle: { fr: d.libelle }, capacite: d.capacite, tarifNuit: d.tarifNuit }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      reset();
    },
  });

  return (
    <div className="space-y-6">
      <TitrePage>Catégories de chambres</TitrePage>
      <Carte titre="Nouvelle catégorie">
        <form onSubmit={handleSubmit((d) => creation.mutate(d))} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Champ label="Code" erreur={e.code?.message}>
              <select className={classeInput} {...register("code")}>
                <option value="STANDARD">STANDARD</option>
                <option value="SUITE_SENIOR">SUITE_SENIOR</option>
                <option value="SUITE_PRESTIGE">SUITE_PRESTIGE</option>
              </select>
            </Champ>
            <Champ label="Libellé" erreur={e.libelle?.message}>
              <input className={classeInput} placeholder="Chambre standard" {...register("libelle")} />
            </Champ>
            <Champ label="Capacité (personnes)" erreur={e.capacite?.message}>
              <input type="number" min={1} step={1} className={classeInput} {...register("capacite", { valueAsNumber: true })} />
            </Champ>
            <Champ label="Tarif par nuit (Ar)" erreur={e.tarifNuit?.message}>
              <input type="number" min={1} step={1} className={classeInput} {...register("tarifNuit", { valueAsNumber: true })} />
            </Champ>
          </div>
          {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
          <Bouton type="submit" enCours={creation.isPending}>
            Créer la catégorie
          </Bouton>
        </form>
      </Carte>

      <Donnees requete={categories} texteVide="Aucune catégorie.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Code</th>
                  <th className={classeTh}>Libellé</th>
                  <th className={`${classeTh} text-right`}>Capacité</th>
                  <th className={`${classeTh} text-right`}>Tarif / nuit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((c) => (
                  <tr key={c.id}>
                    <td className={`${classeTd} font-mono text-xs`}>{c.code}</td>
                    <td className={classeTd}>{texte(c.libelle)}</td>
                    <td className={`${classeTd} text-right`}>{c.capacite}</td>
                    <td className={`${classeTd} text-right`}>{ariary(c.tarifNuit)}</td>
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
