import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
import { Alerte, Badge, Bouton, Carte, Champ, Donnees, Modale, TitrePage, classeInput } from "../../components/ui";
import { api, messageErreur, qs } from "../../lib/api";
import { aujourdhui, dateHeure, libelle, texte } from "../../lib/format";
import { useArticles } from "../../lib/requetes";
import type { StatutTache, Tache } from "../../lib/types";
import { entierPositifOuNul } from "../../lib/validation";

// Articles remplacés à chaque ménage (pré-remplis à 1).
const CODES_ARTICLES = ["GEL_DOUCHE", "PAPIER_HYGIENIQUE", "PANTOUFLE", "BROSSE_A_DENTS"] as const;
const LIBELLES_PAR_DEFAUT: Record<string, string> = {
  GEL_DOUCHE: "Gel douche",
  PAPIER_HYGIENIQUE: "Papier hygiénique",
  PANTOUFLE: "Pantoufles",
  BROSSE_A_DENTS: "Brosse à dents",
};

export function Taches() {
  const { utilisateur } = useAuth();
  const [date, setDate] = useState(aujourdhui());
  const [statut, setStatut] = useState<StatutTache | "">("");
  const [aTerminer, setATerminer] = useState<Tache | null>(null);
  const queryClient = useQueryClient();

  const taches = useQuery({
    queryKey: ["taches", date, statut],
    queryFn: () => api.get<Tache[]>("/taches" + qs({ date, statut })),
  });

  const demarrer = useMutation({
    mutationFn: (id: string) => api.post<Tache>(`/taches/${id}/demarrer`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["taches"] });
      void queryClient.invalidateQueries({ queryKey: ["chambres"] });
    },
  });

  // Seule une femme de ménage peut démarrer / terminer une tâche (règle de la gateway).
  const peutAgir = utilisateur?.role === "FEMME_MENAGE";

  return (
    <div>
      <TitrePage>Tâches de ménage</TitrePage>
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" className={`${classeInput} max-w-xs`} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <select
          className={`${classeInput} max-w-xs`}
          value={statut}
          onChange={(e) => {
            const v = e.target.value;
            setStatut(v === "A_FAIRE" || v === "EN_COURS" || v === "TERMINEE" ? v : "");
          }}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="A_FAIRE">À faire</option>
          <option value="EN_COURS">En cours</option>
          <option value="TERMINEE">Terminée</option>
        </select>
      </div>

      {demarrer.isError && (
        <div className="mb-4">
          <Alerte>{messageErreur(demarrer.error)}</Alerte>
        </div>
      )}

      <Donnees requete={taches} texteVide="Aucune tâche pour ce jour.">
        {(liste) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((t) => (
              <Carte key={t.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xl font-bold">Chambre {t.chambreNumero}</div>
                    <div className="text-sm text-slate-500">Ménage {libelle(t.type).toLowerCase()}</div>
                  </div>
                  <Badge code={t.statut} />
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {t.assigneeNom && <div>Assignée à {t.assigneeNom}</div>}
                  {t.commenceLe && <div>Commencée le {dateHeure(t.commenceLe)}</div>}
                  {t.termineLe && <div>Terminée le {dateHeure(t.termineLe)}</div>}
                  {t.remarques && <div className="italic">« {t.remarques} »</div>}
                </div>
                {peutAgir && (
                  <div className="mt-3">
                    {t.statut === "A_FAIRE" && (
                      <Bouton enCours={demarrer.isPending && demarrer.variables === t.id} onClick={() => demarrer.mutate(t.id)}>
                        Démarrer
                      </Bouton>
                    )}
                    {t.statut === "EN_COURS" && <Bouton onClick={() => setATerminer(t)}>Terminer</Bouton>}
                  </div>
                )}
              </Carte>
            ))}
          </div>
        )}
      </Donnees>

      {aTerminer && <ModaleTerminer tache={aTerminer} onFermer={() => setATerminer(null)} />}
    </div>
  );
}

const schemaTerminer = z.object({
  articles: z.array(z.object({ code: z.string(), quantite: entierPositifOuNul("Quantité entière (0 ou plus)") })),
  remarques: z.string().max(500, "500 caractères maximum"),
});
type FormulaireTerminer = z.infer<typeof schemaTerminer>;

// Fin du ménage : saisie des articles remplacés (1 de chaque par défaut) et remarques.
function ModaleTerminer({ tache, onFermer }: { tache: Tache; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const articles = useArticles();
  const { register, handleSubmit, formState } = useForm<FormulaireTerminer>({
    resolver: zodResolver(schemaTerminer),
    defaultValues: { articles: CODES_ARTICLES.map((code) => ({ code, quantite: 1 })), remarques: "" },
  });

  const terminer = useMutation({
    mutationFn: (data: FormulaireTerminer) =>
      api.post<Tache>(`/taches/${tache.id}/terminer`, {
        articles: data.articles.filter((a) => a.quantite > 0),
        ...(data.remarques.trim() ? { remarques: data.remarques.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["taches"] });
      void queryClient.invalidateQueries({ queryKey: ["chambres"] });
      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      onFermer();
    },
  });

  // Libellé depuis GET /articles, sinon un libellé par défaut (ex. pendant le chargement).
  const libelleArticle = (code: string): string => {
    const a = articles.data?.find((x) => x.code === code);
    return a ? texte(a.libelle) : (LIBELLES_PAR_DEFAUT[code] ?? code);
  };

  return (
    <Modale titre={`Terminer le ménage — chambre ${tache.chambreNumero}`} onFermer={onFermer}>
      <form onSubmit={handleSubmit((d) => terminer.mutate(d))} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">Articles remplacés dans la chambre :</p>
        <div className="grid grid-cols-2 gap-3">
          {CODES_ARTICLES.map((code, i) => (
            <Champ key={code} label={libelleArticle(code)} erreur={formState.errors.articles?.[i]?.quantite?.message}>
              <input type="number" min={0} step={1} className={classeInput} {...register(`articles.${i}.quantite`, { valueAsNumber: true })} />
            </Champ>
          ))}
        </div>
        <Champ label="Remarques (facultatif)" erreur={formState.errors.remarques?.message}>
          <textarea rows={3} className={classeInput} placeholder="Ex. ampoule à changer" {...register("remarques")} />
        </Champ>
        {terminer.isError && <Alerte>{messageErreur(terminer.error)}</Alerte>}
        <Bouton type="submit" enCours={terminer.isPending}>
          Valider : chambre propre
        </Bouton>
      </form>
    </Modale>
  );
}
