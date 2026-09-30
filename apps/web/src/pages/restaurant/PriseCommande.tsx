import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Alerte, Bouton, Carte, Champ, Donnees, TitrePage, classeInput } from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import { ariary, libelle, texte } from "../../lib/format";
import { useMenus } from "../../lib/requetes";
import type { Commande, Plat } from "../../lib/types";

type Canal = "SUR_PLACE" | "A_EMPORTER";

// Prise de commande : on compose un panier (plat → quantité).
// Seuls les identifiants des plats et les quantités sont envoyés : le PRIX est fixé par le serveur.
export function PriseCommande() {
  const menus = useMenus();
  const queryClient = useQueryClient();
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [canal, setCanal] = useState<Canal>("SUR_PLACE");
  const [table, setTable] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [derniere, setDerniere] = useState<Commande | null>(null);

  // Tous les plats disponibles de tous les menus (un plat peut apparaître dans plusieurs menus).
  const plats = new Map<string, Plat>();
  for (const m of menus.data ?? []) for (const p of m.plats) if (p.disponible) plats.set(p.id, p);

  const changerQuantite = (platId: string, delta: number) =>
    setPanier((ancien) => {
      const q = (ancien[platId] ?? 0) + delta;
      const suivant = { ...ancien };
      if (q <= 0) delete suivant[platId];
      else suivant[platId] = q;
      return suivant;
    });

  const lignes = Object.entries(panier).map(([platId, quantite]) => ({ platId, quantite }));
  const estimation = lignes.reduce((total, l) => total + (plats.get(l.platId)?.prix ?? 0) * l.quantite, 0);

  const envoi = useMutation({
    mutationFn: () =>
      api.post<Commande>("/commandes", {
        canal,
        ...(canal === "SUR_PLACE" && table.trim() ? { tableNumero: table.trim() } : {}),
        ...(clientNom.trim() ? { clientNom: clientNom.trim() } : {}),
        lignes,
      }),
    onSuccess: (commande) => {
      void queryClient.invalidateQueries({ queryKey: ["commandes"] });
      setDerniere(commande);
      setPanier({});
      setTable("");
      setClientNom("");
    },
  });

  return (
    <div>
      <TitrePage>Prise de commande</TitrePage>
      {derniere && (
        <div className="mb-4">
          <Alerte type="succes">
            Commande <strong>{derniere.reference}</strong> enregistrée — {ariary(derniere.montantTotal)}.{" "}
            <Link to="/restaurant/commandes" className="underline">
              Voir le suivi
            </Link>
          </Alerte>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Donnees requete={menus} texteVide="Aucun menu : créez-en un dans « Menus et plats ».">
            {(liste) => (
              <div className="space-y-4">
                {liste.map((m) => (
                  <Carte key={m.id} titre={texte(m.nom)}>
                    <ul className="divide-y divide-slate-100">
                      {m.plats
                        .filter((p) => p.disponible)
                        .map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">{texte(p.nom)}</span>
                              <span className="ml-2 text-xs text-slate-500">{libelle(p.categorie)}</span>
                              <span className="block text-slate-600">{ariary(p.prix)}</span>
                            </div>
                            <Bouton variante="secondaire" className="px-2 py-1" onClick={() => changerQuantite(p.id, 1)}>
                              + Ajouter
                            </Bouton>
                          </li>
                        ))}
                    </ul>
                    {m.plats.every((p) => !p.disponible) && <p className="text-sm text-slate-500">Aucun plat disponible.</p>}
                  </Carte>
                ))}
              </div>
            )}
          </Donnees>
        </div>

        <Carte titre="Panier" className="h-fit lg:sticky lg:top-4">
          {lignes.length === 0 ? (
            <p className="text-sm text-slate-500">Le panier est vide.</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100 text-sm">
              {lignes.map((l) => {
                const p = plats.get(l.platId);
                return (
                  <li key={l.platId} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex-1">{p ? texte(p.nom) : "Plat"}</span>
                    <div className="flex items-center gap-1">
                      <Bouton variante="secondaire" className="h-7 w-7 p-0" onClick={() => changerQuantite(l.platId, -1)} aria-label="Retirer un">
                        −
                      </Bouton>
                      <span className="w-6 text-center">{l.quantite}</span>
                      <Bouton variante="secondaire" className="h-7 w-7 p-0" onClick={() => changerQuantite(l.platId, 1)} aria-label="Ajouter un">
                        +
                      </Bouton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="space-y-3">
            <Champ label="Canal">
              <select className={classeInput} value={canal} onChange={(e) => setCanal(e.target.value === "A_EMPORTER" ? "A_EMPORTER" : "SUR_PLACE")}>
                <option value="SUR_PLACE">Sur place</option>
                <option value="A_EMPORTER">À emporter</option>
              </select>
            </Champ>
            {canal === "SUR_PLACE" && (
              <Champ label="Numéro de table">
                <input className={classeInput} value={table} onChange={(e) => setTable(e.target.value)} />
              </Champ>
            )}
            <Champ label="Nom du client (facultatif)">
              <input className={classeInput} value={clientNom} onChange={(e) => setClientNom(e.target.value)} />
            </Champ>
            <p className="text-sm">
              Total estimé : <strong>{ariary(estimation)}</strong>
              <span className="block text-xs text-slate-500">Le montant définitif est calculé par le serveur.</span>
            </p>
            {envoi.isError && <Alerte>{messageErreur(envoi.error)}</Alerte>}
            <Bouton className="w-full" disabled={lignes.length === 0} enCours={envoi.isPending} onClick={() => envoi.mutate()}>
              Envoyer la commande
            </Bouton>
          </div>
        </Carte>
      </div>
    </div>
  );
}
