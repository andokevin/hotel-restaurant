import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Alerte, Badge, Carte, Chargement, MessageErreur, TitrePage } from "../../components/ui";
import { api } from "../../lib/api";
import { ariary, libelle } from "../../lib/format";
import type { Paiement } from "../../lib/types";

const INTERVALLE_MS = 2_000;
const DUREE_MAX_MS = 60_000;

// Page de retour depuis Papi : /paiement/retour?paiement=<id>[&echec=1]
//
// IMPORTANT : l'adresse de retour ne PROUVE RIEN (n'importe qui peut taper cette URL).
// Seul le serveur sait si le paiement a réussi (il reçoit la notification de Papi).
// On interroge donc GET /paiements/:id toutes les 2 s, pendant 60 s au plus.
export function PaiementRetour() {
  const [params] = useSearchParams();
  const { utilisateur } = useAuth();
  const paiementId = params.get("paiement");
  const echecAnnonce = params.get("echec") === "1";
  const [debut] = useState(() => Date.now());
  // Passe à true au bout de 60 s : on arrête alors d'afficher « en attente… ».
  const [delaiDepasse, setDelaiDepasse] = useState(false);
  useEffect(() => {
    const minuteur = setTimeout(() => setDelaiDepasse(true), DUREE_MAX_MS);
    return () => clearTimeout(minuteur);
  }, []);

  const paiement = useQuery({
    queryKey: ["paiements", paiementId],
    queryFn: () => api.get<Paiement>(`/paiements/${encodeURIComponent(paiementId ?? "")}`),
    enabled: Boolean(paiementId),
    // On continue d'interroger tant que le paiement est EN_ATTENTE et que les 60 s ne sont pas écoulées.
    refetchInterval: (query) => {
      const statut = query.state.data?.statut;
      if (statut && statut !== "EN_ATTENTE") return false;
      if (Date.now() - debut > DUREE_MAX_MS) return false;
      return INTERVALLE_MS;
    },
  });

  const lienRetour = utilisateur?.role === "CLIENT" ? "/client/reservations" : "/";

  if (!paiementId) {
    return (
      <div className="mx-auto max-w-lg">
        <TitrePage>Retour de paiement</TitrePage>
        <Alerte>Lien de retour invalide : identifiant de paiement manquant.</Alerte>
      </div>
    );
  }

  const p = paiement.data;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <TitrePage>Résultat du paiement</TitrePage>
      <Carte>
        {paiement.isPending && <Chargement texte="Vérification du paiement auprès du serveur…" />}
        {paiement.isError && <MessageErreur erreur={paiement.error} />}
        {p && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{ariary(p.montant)}</span>
              <Badge code={p.statut} />
            </div>
            {p.methode && <p className="text-slate-600">Méthode : {libelle(p.methode)}</p>}
            {p.facture && (
              <p className="text-slate-600">
                Facture {p.facture.numero} — {libelle(p.facture.statut)}
              </p>
            )}

            {p.statut === "REUSSI" && <Alerte type="succes">Paiement confirmé. Merci ! Votre réservation est confirmée.</Alerte>}
            {p.statut === "ECHOUE" && <Alerte>Le paiement a échoué. Vous pouvez réessayer depuis vos réservations.</Alerte>}
            {p.statut === "ANOMALIE" && (
              <Alerte>Une anomalie a été détectée sur ce paiement. Contactez la réception de l'hôtel.</Alerte>
            )}
            {p.statut === "EN_ATTENTE" &&
              (delaiDepasse ? (
                <Alerte type="attention">
                  Le paiement n'est toujours pas confirmé. Il peut encore aboutir : consultez vos réservations dans
                  quelques minutes.
                </Alerte>
              ) : (
                <Chargement texte={echecAnnonce ? "Papi signale un problème, vérification en cours…" : "Paiement en attente de confirmation…"} />
              ))}
          </div>
        )}
      </Carte>
      <Link to={lienRetour} className="inline-block text-sm font-medium text-emerald-800 hover:underline">
        ← Retour
      </Link>
    </div>
  );
}
