import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
import { Alerte, Bouton, Carte, Champ, classeInput } from "../../components/ui";
import { api, messageErreur } from "../../lib/api";
import type { Utilisateur } from "../../lib/types";
import { champEmail, champMotDePasse, champNom, champTelephone, normaliserTelephone } from "../../lib/validation";

const schema = z
  .object({
    nom: champNom,
    telephone: champTelephone,
    email: champEmail,
    motDePasse: champMotDePasse,
    confirmation: z.string(),
    langue: z.enum(["FR", "MG", "EN"]),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmation"],
  });
type Formulaire = z.infer<typeof schema>;

export function Inscription() {
  const { connecter } = useAuth();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: { langue: "FR" },
  });
  const e = formState.errors;

  const onSubmit = async (data: Formulaire) => {
    setErreur(null);
    try {
      const telephone = normaliserTelephone(data.telephone);
      await api.post<Utilisateur>("/auth/inscription", {
        nom: data.nom,
        telephone,
        email: data.email,
        motDePasse: data.motDePasse,
        langue: data.langue,
      });
      // Compte créé : on connecte directement le client.
      await connecter(telephone, data.motDePasse);
      navigate("/client/reserver", { replace: true });
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Carte titre="Créer un compte client">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Champ label="Nom complet" erreur={e.nom?.message}>
            <input className={classeInput} autoComplete="name" {...register("nom")} />
          </Champ>
          <Champ label="Téléphone" erreur={e.telephone?.message}>
            <input className={classeInput} autoComplete="tel" placeholder="034 12 345 67" {...register("telephone")} />
          </Champ>
          <Champ label="Email" erreur={e.email?.message}>
            <input type="email" className={classeInput} autoComplete="email" {...register("email")} />
          </Champ>
          <Champ label="Mot de passe (10 caractères minimum)" erreur={e.motDePasse?.message}>
            <input type="password" className={classeInput} autoComplete="new-password" {...register("motDePasse")} />
          </Champ>
          <Champ label="Confirmer le mot de passe" erreur={e.confirmation?.message}>
            <input type="password" className={classeInput} autoComplete="new-password" {...register("confirmation")} />
          </Champ>
          <Champ label="Langue" erreur={e.langue?.message}>
            <select className={classeInput} {...register("langue")}>
              <option value="FR">Français</option>
              <option value="MG">Malagasy</option>
              <option value="EN">English</option>
            </select>
          </Champ>
          {erreur && <Alerte>{erreur}</Alerte>}
          <Bouton type="submit" enCours={formState.isSubmitting} className="w-full">
            Créer mon compte
          </Bouton>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Déjà inscrit ?{" "}
          <Link to="/connexion" className="font-medium text-emerald-800 hover:underline">
            Se connecter
          </Link>
        </p>
      </Carte>
    </div>
  );
}
