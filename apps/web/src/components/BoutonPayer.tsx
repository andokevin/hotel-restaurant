import { useMutation } from "@tanstack/react-query";
import { ApiError, api, messageErreur } from "../lib/api";
import type { ReponseCreationPaiement } from "../lib/types";
import { Alerte, Bouton } from "./ui";

// Cible du paiement : une réservation OU une facture. Le montant n'est JAMAIS envoyé :
// c'est le serveur qui le calcule (on ne fait pas confiance au navigateur).
type Cible = { reservationId: string } | { factureId: string };

const messagePaiement = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.code === "FACTURE_DEJA_PAYEE") return "Cette facture est déjà payée.";
    if (err.code === "RESERVATION_ANNULEE") return "Cette réservation est annulée : elle ne peut plus être payée.";
    if (err.status === 502) return "Le service de paiement Papi est momentanément indisponible. Réessayez dans un instant.";
  }
  return messageErreur(err);
};

// Demande un lien de paiement Papi puis redirige le navigateur vers la page Papi.
// Au retour, Papi renvoie sur /paiement/retour?paiement=<id>.
export function BoutonPayer({ cible, libelleBouton = "Payer avec Papi" }: { cible: Cible; libelleBouton?: string }) {
  const paiement = useMutation({
    mutationFn: () => api.post<ReponseCreationPaiement>("/paiements", cible),
    onSuccess: (rep) => {
      window.location.href = rep.url;
    },
  });

  return (
    <div className="space-y-2">
      <Bouton onClick={() => paiement.mutate()} enCours={paiement.isPending || paiement.isSuccess}>
        {paiement.isSuccess ? "Redirection vers Papi…" : libelleBouton}
      </Bouton>
      {paiement.isError && <Alerte>{messagePaiement(paiement.error)}</Alerte>}
    </div>
  );
}

// Variante pour le comptoir : on affiche le lien au lieu de rediriger,
// pour que la réceptionniste puisse l'ouvrir ou le transmettre au client.
export function LienPaiementComptoir({ cible }: { cible: Cible }) {
  const paiement = useMutation({
    mutationFn: () => api.post<ReponseCreationPaiement>("/paiements", cible),
  });

  return (
    <div className="space-y-2">
      <Bouton variante="secondaire" onClick={() => paiement.mutate()} enCours={paiement.isPending}>
        Générer un lien Papi
      </Bouton>
      {paiement.isError && <Alerte>{messagePaiement(paiement.error)}</Alerte>}
      {paiement.data && (
        <Alerte type="info">
          Lien de paiement ({paiement.data.montant.toLocaleString("fr-FR")} Ar) :{" "}
          <a href={paiement.data.url} target="_blank" rel="noreferrer" className="break-all font-medium underline">
            {paiement.data.url}
          </a>
        </Alerte>
      )}
    </div>
  );
}
