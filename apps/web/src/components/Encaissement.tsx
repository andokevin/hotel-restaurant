import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, api, messageErreur } from "../lib/api";
import { ariary } from "../lib/format";
import type { Facture } from "../lib/types";
import { entierPositif } from "../lib/validation";
import { Alerte, Bouton, Champ, classeInput } from "./ui";

// Encaissement en espèces d'une partie ou de la totalité du reste à payer.
export function FormulaireEncaissement({ facture, onEncaisse }: { facture: Facture; onEncaisse?: () => void }) {
  const queryClient = useQueryClient();
  const reste = facture.montantTotal - facture.montantPaye;

  const schema = z.object({
    montant: entierPositif("Montant en Ariary (entier positif)").max(reste, `Au plus ${ariary(reste)} (reste à payer)`),
  });
  type Formulaire = z.infer<typeof schema>;

  const { register, handleSubmit, formState, reset } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: { montant: reste },
  });

  const encaissement = useMutation({
    mutationFn: (data: Formulaire) => api.post<Facture>(`/factures/${facture.id}/encaissements`, { montant: data.montant }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["factures"] });
      void queryClient.invalidateQueries({ queryKey: ["commandes"] });
      reset();
      onEncaisse?.();
    },
  });

  if (reste <= 0) return null;

  const erreur =
    encaissement.error instanceof ApiError && encaissement.error.code === "MONTANT_SUPERIEUR_AU_RESTE"
      ? "Le montant dépasse le reste à payer de la facture."
      : encaissement.error
        ? messageErreur(encaissement.error)
        : null;

  return (
    <form onSubmit={handleSubmit((d) => encaissement.mutate(d))} className="space-y-2" noValidate>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Champ label="Encaisser en espèces (Ar)" erreur={formState.errors.montant?.message}>
            <input type="number" min={1} max={reste} step={1} className={classeInput} {...register("montant", { valueAsNumber: true })} />
          </Champ>
        </div>
        <Bouton type="submit" enCours={encaissement.isPending}>
          Encaisser
        </Bouton>
      </div>
      {erreur && <Alerte>{erreur}</Alerte>}
      {encaissement.isSuccess && <Alerte type="succes">Encaissement enregistré.</Alerte>}
    </form>
  );
}
