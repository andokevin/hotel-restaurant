import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  Donnees,
  Modale,
  TableDefilante,
  TitrePage,
  classeInput,
  classeTable,
  classeTd,
  classeTh,
} from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import { dateHeure, libelle, texte } from "../../lib/format";
import { useArticles } from "../../lib/requetes";
import type { Article, Mouvement } from "../../lib/types";
import { entierPositif, entierPositifOuNul } from "../../lib/validation";

const LIBELLES_MOTIF: Record<string, string> = {
  APPROVISIONNEMENT: "Approvisionnement",
  AJUSTEMENT_INVENTAIRE: "Ajustement d'inventaire",
  PERTE: "Perte",
};

// Stock des articles d'accueil. Utilisé par le COMPTABLE et par l'ADMIN (qui peut aussi créer des articles).
export function Stock({ peutCreer = false }: { peutCreer?: boolean }) {
  const articles = useArticles();
  const [mouvementPour, setMouvementPour] = useState<Article | null>(null);
  const [historiquePour, setHistoriquePour] = useState<Article | null>(null);

  return (
    <div className="space-y-6">
      <TitrePage>{peutCreer ? "Articles et approvisionnement" : "Stock"}</TitrePage>
      {peutCreer && (
        <Carte titre="Nouvel article">
          <FormulaireArticle />
        </Carte>
      )}
      <Donnees requete={articles} texteVide="Aucun article en stock.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Article</th>
                  <th className={classeTh}>Code</th>
                  <th className={`${classeTh} text-right`}>Quantité</th>
                  <th className={`${classeTh} text-right`}>Seuil d'alerte</th>
                  <th className={`${classeTh} text-right`}>Conso. / nuitée</th>
                  <th className={classeTh}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((a) => (
                  <tr key={a.id} className={a.enAlerte ? "bg-red-50" : ""}>
                    <td className={classeTd}>
                      {texte(a.libelle)}
                      {a.enAlerte && <span className="ml-2 text-xs font-semibold text-red-700">Stock bas</span>}
                    </td>
                    <td className={`${classeTd} font-mono text-xs`}>{a.code}</td>
                    <td className={`${classeTd} text-right font-semibold ${a.enAlerte ? "text-red-700" : ""}`}>{a.quantite}</td>
                    <td className={`${classeTd} text-right`}>{a.seuilAlerte}</td>
                    <td className={`${classeTd} text-right`}>{a.consommationParNuitee}</td>
                    <td className={classeTd}>
                      <div className="flex flex-wrap gap-1">
                        <Bouton className="px-2 py-1 text-xs" onClick={() => setMouvementPour(a)}>
                          Mouvement
                        </Bouton>
                        <Bouton variante="secondaire" className="px-2 py-1 text-xs" onClick={() => setHistoriquePour(a)}>
                          Historique
                        </Bouton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>

      {mouvementPour && <ModaleMouvement article={mouvementPour} onFermer={() => setMouvementPour(null)} />}
      {historiquePour && <ModaleHistorique article={historiquePour} onFermer={() => setHistoriquePour(null)} />}
    </div>
  );
}

const schemaMouvement = z.object({
  type: z.enum(["ENTREE", "SORTIE"]),
  motif: z.enum(["APPROVISIONNEMENT", "AJUSTEMENT_INVENTAIRE", "PERTE"]),
  quantite: entierPositif("Quantité entière positive"),
});
type FormulaireMouvement = z.infer<typeof schemaMouvement>;

function ModaleMouvement({ article, onFermer }: { article: Article; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm<FormulaireMouvement>({
    resolver: zodResolver(schemaMouvement),
    defaultValues: { type: "ENTREE", motif: "APPROVISIONNEMENT" },
  });
  const mouvement = useMutation({
    mutationFn: (d: FormulaireMouvement) => api.post<Mouvement>(`/articles/${article.id}/mouvements`, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      void queryClient.invalidateQueries({ queryKey: ["mouvements", article.id] });
      onFermer();
    },
  });

  return (
    <Modale titre={`Mouvement de stock — ${texte(article.libelle)}`} onFermer={onFermer}>
      <form onSubmit={handleSubmit((d) => mouvement.mutate(d))} className="space-y-3" noValidate>
        <p className="text-sm text-slate-600">Stock actuel : {article.quantite}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Type" erreur={formState.errors.type?.message}>
            <select className={classeInput} {...register("type")}>
              <option value="ENTREE">Entrée</option>
              <option value="SORTIE">Sortie</option>
            </select>
          </Champ>
          <Champ label="Motif" erreur={formState.errors.motif?.message}>
            <select className={classeInput} {...register("motif")}>
              {Object.entries(LIBELLES_MOTIF).map(([code, lib]) => (
                <option key={code} value={code}>
                  {lib}
                </option>
              ))}
            </select>
          </Champ>
        </div>
        <Champ label="Quantité" erreur={formState.errors.quantite?.message}>
          <input type="number" min={1} step={1} className={classeInput} {...register("quantite", { valueAsNumber: true })} />
        </Champ>
        {mouvement.isError && <Alerte>{messageErreur(mouvement.error)}</Alerte>}
        <Bouton type="submit" enCours={mouvement.isPending}>
          Enregistrer
        </Bouton>
      </form>
    </Modale>
  );
}

function ModaleHistorique({ article, onFermer }: { article: Article; onFermer: () => void }) {
  const mouvements = useQuery({
    queryKey: ["mouvements", article.id],
    queryFn: () => api.get<Mouvement[]>(`/articles/${article.id}/mouvements`),
  });
  return (
    <Modale titre={`Historique — ${texte(article.libelle)}`} onFermer={onFermer}>
      <Donnees requete={mouvements} texteVide="Aucun mouvement enregistré.">
        {(liste) => (
          <ul className="divide-y divide-slate-100 text-sm">
            {liste.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className={m.type === "ENTREE" ? "text-emerald-700" : "text-red-700"}>
                  {m.type === "ENTREE" ? "+" : "−"}
                  {m.quantite} · {LIBELLES_MOTIF[m.motif] ?? libelle(m.motif)}
                </span>
                <span className="text-slate-500">{dateHeure(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Donnees>
    </Modale>
  );
}

const schemaArticle = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,40}$/, "Majuscules, chiffres et _ uniquement (ex. SAVON)"),
  libelle: z.string().trim().min(2, "2 caractères minimum").max(100),
  seuilAlerte: entierPositifOuNul(),
  consommationParNuitee: entierPositifOuNul(),
});
type FormulaireArticleDonnees = z.infer<typeof schemaArticle>;

function FormulaireArticle() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<FormulaireArticleDonnees>({
    resolver: zodResolver(schemaArticle),
    defaultValues: { code: "", libelle: "", seuilAlerte: 10, consommationParNuitee: 1 },
  });
  const e = formState.errors;
  const creation = useMutation({
    mutationFn: (d: FormulaireArticleDonnees) =>
      api.post<Article>("/articles", {
        code: d.code,
        libelle: { fr: d.libelle },
        seuilAlerte: d.seuilAlerte,
        consommationParNuitee: d.consommationParNuitee,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      reset();
    },
  });
  return (
    <form onSubmit={handleSubmit((d) => creation.mutate(d))} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ label="Code" erreur={e.code?.message}>
          <input className={classeInput} placeholder="SAVON" {...register("code")} />
        </Champ>
        <Champ label="Libellé" erreur={e.libelle?.message}>
          <input className={classeInput} placeholder="Savon" {...register("libelle")} />
        </Champ>
        <Champ label="Seuil d'alerte" erreur={e.seuilAlerte?.message}>
          <input type="number" min={0} step={1} className={classeInput} {...register("seuilAlerte", { valueAsNumber: true })} />
        </Champ>
        <Champ label="Consommation par nuitée" erreur={e.consommationParNuitee?.message}>
          <input type="number" min={0} step={1} className={classeInput} {...register("consommationParNuitee", { valueAsNumber: true })} />
        </Champ>
      </div>
      {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
      <Bouton type="submit" enCours={creation.isPending}>
        Créer l'article
      </Bouton>
    </form>
  );
}
