import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
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
import { dateCourte, libelle } from "../../lib/format";
import { ROLES, type Role, type Utilisateur } from "../../lib/types";
import { champEmail, champMotDePasse, champNom, champTelephone, normaliserTelephone } from "../../lib/validation";

const estRole = (v: string): v is Role => ROLES.some((r) => r === v);

export function Comptes() {
  const { utilisateur: moi } = useAuth();
  const queryClient = useQueryClient();
  const utilisateurs = useQuery({
    queryKey: ["utilisateurs"],
    queryFn: () => api.get<Utilisateur[]>("/auth/utilisateurs"),
  });

  const modification = useMutation({
    mutationFn: ({ id, corps }: { id: string; corps: { actif?: boolean; role?: Role } }) =>
      api.patch<Utilisateur>(`/auth/utilisateurs/${id}`, corps),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["utilisateurs"] }),
  });

  return (
    <div className="space-y-6">
      <TitrePage>Comptes utilisateurs</TitrePage>
      <Carte titre="Créer un compte du personnel">
        <FormulaireCompte />
      </Carte>

      {modification.isError && <Alerte>{messageErreur(modification.error)}</Alerte>}

      <Donnees requete={utilisateurs} texteVide="Aucun compte.">
        {(liste) => (
          <TableDefilante>
            <table className={classeTable}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={classeTh}>Nom</th>
                  <th className={classeTh}>Contact</th>
                  <th className={classeTh}>Rôle</th>
                  <th className={classeTh}>Créé le</th>
                  <th className={classeTh}>État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((u) => {
                  const cestMoi = u.id === moi?.id; // on évite de se retirer ses propres droits
                  return (
                    <tr key={u.id} className={u.actif ? "" : "text-slate-400"}>
                      <td className={classeTd}>{u.nom}</td>
                      <td className={classeTd}>
                        {u.telephone}
                        <span className="block text-xs text-slate-500">{u.email}</span>
                      </td>
                      <td className={classeTd}>
                        <select
                          className={`${classeInput} w-44`}
                          value={u.role}
                          disabled={cestMoi || modification.isPending}
                          onChange={(e) => {
                            const role = e.target.value;
                            if (estRole(role)) modification.mutate({ id: u.id, corps: { role } });
                          }}
                          aria-label={`Rôle de ${u.nom}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {libelle(r)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={classeTd}>{dateCourte(u.createdAt)}</td>
                      <td className={classeTd}>
                        <Bouton
                          variante={u.actif ? "secondaire" : "primaire"}
                          className="px-2 py-1 text-xs"
                          disabled={cestMoi}
                          enCours={modification.isPending && modification.variables.id === u.id}
                          onClick={() => modification.mutate({ id: u.id, corps: { actif: !u.actif } })}
                        >
                          {u.actif ? "Désactiver" : "Réactiver"}
                        </Bouton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableDefilante>
        )}
      </Donnees>
    </div>
  );
}

const schema = z.object({
  nom: champNom,
  telephone: champTelephone,
  email: champEmail,
  motDePasse: champMotDePasse,
  role: z.enum(ROLES),
});
type Formulaire = z.infer<typeof schema>;

function FormulaireCompte() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, reset } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", telephone: "", email: "", motDePasse: "", role: "RECEPTIONNISTE" },
  });
  const e = formState.errors;
  const creation = useMutation({
    mutationFn: (d: Formulaire) => api.post<Utilisateur>("/auth/utilisateurs", { ...d, telephone: normaliserTelephone(d.telephone) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      reset();
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => creation.mutate(d))} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Champ label="Nom" erreur={e.nom?.message}>
          <input className={classeInput} {...register("nom")} />
        </Champ>
        <Champ label="Téléphone" erreur={e.telephone?.message}>
          <input className={classeInput} placeholder="034 12 345 67" {...register("telephone")} />
        </Champ>
        <Champ label="Email" erreur={e.email?.message}>
          <input type="email" className={classeInput} {...register("email")} />
        </Champ>
        <Champ label="Mot de passe provisoire" erreur={e.motDePasse?.message}>
          <input type="password" autoComplete="new-password" className={classeInput} {...register("motDePasse")} />
        </Champ>
        <Champ label="Rôle" erreur={e.role?.message}>
          <select className={classeInput} {...register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {libelle(r)}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      {creation.isError && <Alerte>{messageErreur(creation.error)}</Alerte>}
      {creation.isSuccess && <Alerte type="succes">Compte créé.</Alerte>}
      <Bouton type="submit" enCours={creation.isPending}>
        Créer le compte
      </Bouton>
    </form>
  );
}
