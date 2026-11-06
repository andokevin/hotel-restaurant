import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alerte, Bouton, Champ, Chargement, MessageErreur, Modale, classeInput } from "../../components/ui";
import { ApiError, api, messageErreur } from "../../lib/api";
import { dateCourte, personnes } from "../../lib/format";
import { useChambres } from "../../lib/requetes";
import type { Reservation } from "../../lib/types";

// La chambre prévue n'est pas propre : le serveur répond 422 avec un message qui le dit.
const chambreNonPropre = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 422 && /propre/i.test(err.message);

// Check-in d'une réservation CONFIRMEE.
// 1. La réceptionniste coche « pièce d'identité vérifiée » (obligatoire côté serveur).
// 2. Si la chambre prévue n'est pas propre, on propose une autre chambre PROPRE de la même catégorie.
export function ModaleCheckIn({ reservation, onFermer }: { reservation: Reservation; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const [pieceVerifiee, setPieceVerifiee] = useState(false);
  const [chambreId, setChambreId] = useState("");

  const checkIn = useMutation({
    mutationFn: (autreChambreId?: string) =>
      api.post<Reservation>(`/reservations/${reservation.id}/check-in`, {
        pieceIdentiteVerifiee: true,
        ...(autreChambreId ? { chambreId: autreChambreId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["chambres"] });
      onFermer();
    },
  });

  const reattribuer = chambreNonPropre(checkIn.error);

  return (
    <Modale titre={`Check-in — ${reservation.reference}`} onFermer={onFermer}>
      <div className="space-y-4 text-sm">
        <p>
          <strong>{reservation.clientNom}</strong> ({personnes(reservation)}) · du {dateCourte(reservation.dateArrivee)} au{" "}
          {dateCourte(reservation.dateDepart)}
          {reservation.chambre && <> · chambre prévue n° {reservation.chambre.numero}</>}
        </p>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pieceVerifiee} onChange={(e) => setPieceVerifiee(e.target.checked)} className="h-4 w-4" />
          J'ai vérifié la pièce d'identité du client
        </label>

        {checkIn.isError && !reattribuer && <Alerte>{messageErreur(checkIn.error)}</Alerte>}

        {reattribuer ? (
          <>
            <Alerte type="attention">{messageErreur(checkIn.error)}</Alerte>
            <ChoixChambrePropre categorieId={reservation.chambre?.categorieId ?? reservation.categorieId} valeur={chambreId} onChange={setChambreId} />
            <Bouton disabled={!pieceVerifiee || !chambreId} enCours={checkIn.isPending} onClick={() => checkIn.mutate(chambreId)}>
              Faire le check-in dans cette chambre
            </Bouton>
          </>
        ) : (
          <Bouton disabled={!pieceVerifiee} enCours={checkIn.isPending} onClick={() => checkIn.mutate(undefined)}>
            Valider le check-in
          </Bouton>
        )}
      </div>
    </Modale>
  );
}

function ChoixChambrePropre({
  categorieId,
  valeur,
  onChange,
}: {
  categorieId: string | undefined;
  valeur: string;
  onChange: (id: string) => void;
}) {
  const chambres = useChambres("PROPRE");
  if (chambres.isPending) return <Chargement texte="Recherche des chambres propres…" />;
  if (chambres.isError) return <MessageErreur erreur={chambres.error} />;

  const possibles = chambres.data.filter((c) => !c.horsService && (!categorieId || c.categorieId === categorieId));
  if (possibles.length === 0) {
    return <Alerte>Aucune chambre propre de cette catégorie n'est disponible pour le moment.</Alerte>;
  }
  return (
    <Champ label="Réattribuer une chambre propre de la même catégorie">
      <select className={classeInput} value={valeur} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Choisir une chambre —</option>
        {possibles.map((c) => (
          <option key={c.id} value={c.id}>
            n° {c.numero} (étage {c.etage})
          </option>
        ))}
      </select>
    </Champ>
  );
}
