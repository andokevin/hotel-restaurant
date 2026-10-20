import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
import { Alerte, Badge, Bouton, Carte, Champ, Donnees, Modale, Pastilles, TitrePage, classeInput } from "../../components/ui";
import { api, messageErreur, qs } from "../../lib/api";
import { ajouterJours, aujourdhui, dateCourte, dateHeure, libelle, texte } from "../../lib/format";
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

  // Ordre d'affichage : d'abord ce qui reste à faire, les tâches terminées à la fin.
  const ORDRE: Record<StatutTache, number> = { EN_COURS: 0, A_FAIRE: 1, TERMINEE: 2 };
  const restantes = taches.data?.filter((t) => t.statut !== "TERMINEE").length ?? 0;
  const estAujourdhui = date === aujourdhui();

  return (
    <div>
      <TitrePage
        sousTitre={
          taches.data
            ? `${restantes} chambre(s) à faire sur ${taches.data.length} ${estAujourdhui ? "aujourd'hui" : `le ${dateCourte(date)}`}`
            : undefined
        }
      >
        Tâches de ménage
      </TitrePage>
      <div className="mb-4 space-y-3">
        {/* Changer de jour en un geste, sans ouvrir le calendrier */}
        <div className="flex items-center gap-2">
          <Bouton variante="secondaire" taille="icone" onClick={() => setDate(ajouterJours(date, -1))} aria-label="Jour précédent">
            ‹
          </Bouton>
          <input type="date" className={`${classeInput} max-w-[12rem] text-center`} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <Bouton variante="secondaire" taille="icone" onClick={() => setDate(ajouterJours(date, 1))} aria-label="Jour suivant">
            ›
          </Bouton>
          {!estAujourdhui && (
            <Bouton variante="discret" taille="petit" onClick={() => setDate(aujourdhui())}>
              Aujourd'hui
            </Bouton>
          )}
        </div>
        <Pastilles<StatutTache | "">
          label="Filtrer par statut"
          valeur={statut}
          onChange={setStatut}
          options={[
            { valeur: "", libelle: "Toutes" },
            { valeur: "A_FAIRE", libelle: "À faire" },
            { valeur: "EN_COURS", libelle: "En cours" },
            { valeur: "TERMINEE", libelle: "Terminées" },
          ]}
        />
      </div>

      {demarrer.isError && (
        <div className="mb-4">
          <Alerte>{messageErreur(demarrer.error)}</Alerte>
        </div>
      )}

      <Donnees requete={taches} texteVide="Aucune tâche pour ce jour.">
        {(liste) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...liste].sort((a, b) => ORDRE[a.statut] - ORDRE[b.statut]).map((t) => (
              <Carte key={t.id} className={t.statut === "TERMINEE" ? "opacity-70" : t.statut === "EN_COURS" ? "border-l-4 border-l-indigo-500" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-titre text-2xl font-bold">Chambre {t.chambreNumero}</div>
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
                  <div className="mt-4">
                    {t.statut === "A_FAIRE" && (
                      <Bouton className="w-full" enCours={demarrer.isPending && demarrer.variables === t.id} onClick={() => demarrer.mutate(t.id)}>
                        Démarrer le ménage
                      </Bouton>
                    )}
                    {t.statut === "EN_COURS" && (
                      <Bouton variante="accent" className="w-full" onClick={() => setATerminer(t)}>
                        Terminer : chambre propre
                      </Bouton>
                    )}
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
              <input type="number" inputMode="numeric" min={0} step={1} className={classeInput} {...register(`articles.${i}.quantite`, { valueAsNumber: true })} />
            </Champ>
          ))}
        </div>
        <Champ label="Remarques (facultatif)" erreur={formState.errors.remarques?.message}>
          <textarea rows={3} className={classeInput} placeholder="Ex. ampoule à changer" {...register("remarques")} />
        </Champ>
        {terminer.isError && <Alerte>{messageErreur(terminer.error)}</Alerte>}
        <Bouton type="submit" className="w-full" enCours={terminer.isPending}>
          Valider : chambre propre
        </Bouton>
      </form>
    </Modale>
  );
}
