import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DetailFacture } from "../../components/DetailFacture";
import { FormulaireEncaissement } from "../../components/Encaissement";
import { Alerte, Badge, Bouton, Carte, Chargement, Donnees, MessageErreur, Modale, ModaleConfirmation, TitrePage, classeInput } from "../../components/ui";
import { ApiError, api, messageErreur, qs } from "../../lib/api";
import { ariary, libelle } from "../../lib/format";
import type { Commande, Facture, StatutCommande } from "../../lib/types";

const STATUTS: StatutCommande[] = ["RECUE", "EN_PREPARATION", "PRETE", "REMISE", "ANNULEE"];

// Étape suivante possible pour chaque statut (circuit cuisine → service).
const SUIVANT: Partial<Record<StatutCommande, { statut: StatutCommande; action: string }>> = {
  RECUE: { statut: "EN_PREPARATION", action: "Lancer la préparation" },
  EN_PREPARATION: { statut: "PRETE", action: "Marquer prête" },
  PRETE: { statut: "REMISE", action: "Marquer remise au client" },
};

export function SuiviCommandes() {
  const [statut, setStatut] = useState("");
  const [factureOuverte, setFactureOuverte] = useState<string | null>(null);

  const commandes = useQuery({
    queryKey: ["commandes", statut],
    queryFn: () => api.get<Commande[]>("/commandes" + qs({ statut })),
    refetchInterval: 15_000, // la cuisine voit arriver les nouvelles commandes sans recharger
  });

  return (
    <div>
      <TitrePage>Suivi des commandes</TitrePage>
      <div className="mb-4 max-w-xs">
        <select className={classeInput} value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {libelle(s)}
            </option>
          ))}
        </select>
      </div>

      <Donnees requete={commandes} texteVide="Aucune commande.">
        {(liste) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liste.map((c) => (
              <CarteCommande key={c.id} commande={c} onFacture={setFactureOuverte} />
            ))}
          </div>
        )}
      </Donnees>

      {factureOuverte && <ModaleEncaissement factureId={factureOuverte} onFermer={() => setFactureOuverte(null)} />}
    </div>
  );
}

function CarteCommande({ commande, onFacture }: { commande: Commande; onFacture: (factureId: string) => void }) {
  const c = commande;
  const queryClient = useQueryClient();
  const [chambre, setChambre] = useState("");
  const [imputation, setImputation] = useState(false);
  const [annulation, setAnnulation] = useState(false);

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["commandes"] });
    void queryClient.invalidateQueries({ queryKey: ["factures"] });
  };

  const changerStatut = useMutation({
    mutationFn: (nouveau: StatutCommande) => api.post<Commande>(`/commandes/${c.id}/statut`, { statut: nouveau }),
    onSuccess: rafraichir,
  });

  const imputer = useMutation({
    mutationFn: () => api.post<Commande>(`/commandes/${c.id}/imputer`, { chambreNumero: chambre.trim() }),
    onSuccess: () => {
      setImputation(false);
      rafraichir();
    },
  });

  const facturer = useMutation({
    mutationFn: () => api.post<{ factureId: string; numero: string; montant: number }>(`/commandes/${c.id}/facturer`),
    onSuccess: (rep) => {
      rafraichir();
      onFacture(rep.factureId); // on enchaîne directement sur l'encaissement
    },
  });

  const suivant = SUIVANT[c.statut];
  const erreur = changerStatut.error ?? imputer.error ?? facturer.error;
  const messageImputation =
    imputer.error instanceof ApiError && imputer.error.status === 422
      ? `Aucun séjour en cours dans la chambre ${chambre} : impossible d'imputer.`
      : null;

  return (
    <Carte>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono font-semibold">{c.reference}</span>
        <div className="flex gap-1">
          <Badge code={c.statut} />
          <Badge code={c.statutPaiement} />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {libelle(c.canal)}
        {c.tableNumero ? ` · table ${c.tableNumero}` : ""}
        {c.clientNom ? ` · ${c.clientNom}` : ""}
      </p>
      <ul className="my-2 text-sm">
        {c.lignes.map((l, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {l.quantite} × {l.platNom}
            </span>
            <span>{ariary(l.prixUnitaire * l.quantite)}</span>
          </li>
        ))}
      </ul>
      <p className="text-right font-semibold">{ariary(c.montantTotal)}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {suivant && (
          <Bouton taille="petit" className="flex-1 sm:flex-none" enCours={changerStatut.isPending} onClick={() => changerStatut.mutate(suivant.statut)}>
            {suivant.action}
          </Bouton>
        )}
        {c.statutPaiement === "NON_PAYEE" && c.statut !== "ANNULEE" && (
          <>
            <Bouton variante="secondaire" taille="petit" aria-expanded={imputation} onClick={() => setImputation((v) => !v)}>
              Imputer à une chambre
            </Bouton>
            <Bouton variante="secondaire" taille="petit" enCours={facturer.isPending} onClick={() => facturer.mutate()}>
              Facturer et encaisser
            </Bouton>
          </>
        )}
        {(c.statut === "RECUE" || c.statut === "EN_PREPARATION") && (
          <Bouton variante="discretDanger" taille="petit" className="ml-auto" onClick={() => setAnnulation(true)}>
            Annuler
          </Bouton>
        )}
      </div>

      {annulation && (
        <ModaleConfirmation
          titre={`Annuler la commande ${c.reference} ?`}
          libelleConfirmer="Oui, annuler la commande"
          variante="danger"
          enCours={changerStatut.isPending}
          erreur={changerStatut.error}
          onConfirmer={() => changerStatut.mutate("ANNULEE", { onSuccess: () => setAnnulation(false) })}
          onAnnuler={() => {
            setAnnulation(false);
            changerStatut.reset();
          }}
        >
          <p>
            {c.lignes.length} plat(s) pour {ariary(c.montantTotal)}. La cuisine ne la verra plus dans les commandes à préparer.
          </p>
        </ModaleConfirmation>
      )}

      {imputation && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (chambre.trim()) imputer.mutate();
          }}
        >
          <input className={`${classeInput} w-32`} placeholder="N° chambre" value={chambre} onChange={(e) => setChambre(e.target.value)} aria-label="Numéro de chambre" />
          <Bouton type="submit" taille="petit" disabled={!chambre.trim()} enCours={imputer.isPending}>
            Ajouter à la facture de la chambre
          </Bouton>
        </form>
      )}

      {erreur && (
        <div className="mt-2">
          <Alerte>{messageImputation ?? messageErreur(erreur)}</Alerte>
        </div>
      )}
    </Carte>
  );
}

// Facture d'une commande « à régler tout de suite » : encaissement en espèces.
function ModaleEncaissement({ factureId, onFermer }: { factureId: string; onFermer: () => void }) {
  const facture = useQuery({
    queryKey: ["factures", "detail", factureId],
    queryFn: () => api.get<Facture>(`/factures/${factureId}`),
  });
  return (
    <Modale titre="Encaissement" onFermer={onFermer}>
      {facture.isPending && <Chargement />}
      {facture.isError && <MessageErreur erreur={facture.error} />}
      {facture.data && (
        <div className="space-y-4">
          <DetailFacture facture={facture.data} />
          {facture.data.montantPaye >= facture.data.montantTotal ? (
            <Alerte type="succes">Facture entièrement payée.</Alerte>
          ) : (
            <FormulaireEncaissement key={facture.data.montantPaye} facture={facture.data} />
          )}
        </div>
      )}
    </Modale>
  );
}
