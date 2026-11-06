import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../../auth/AuthContext";
import { lireDepuis } from "../../auth/depuis";
import { ESPACE_DU_ROLE } from "../../auth/roles";
import { Alerte, Bouton, Carte, Champ, classeInput } from "../../components/ui";
import { ApiError, messageErreur } from "../../lib/api";

const schema = z.object({
  identifiant: z.string().trim().min(1, "Téléphone ou email requis"),
  motDePasse: z.string().min(1, "Mot de passe requis"),
});
type Formulaire = z.infer<typeof schema>;

// Messages plus parlants pour les erreurs connues de /auth/connexion.
const messageConnexion = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.code === "IDENTIFIANTS_INVALIDES") return "Identifiant ou mot de passe incorrect.";
    if (err.code === "COMPTE_DESACTIVE") return "Ce compte est désactivé. Contactez l'administrateur.";
    if (err.code === "TROP_DE_TENTATIVES" || err.status === 429) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  }
  return messageErreur(err);
};

export function Connexion() {
  const { utilisateur, connecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [erreur, setErreur] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Formulaire>({ resolver: zodResolver(schema) });

  // Page d'où l'on venait (posée par RouteProtegee), sinon l'espace du rôle.
  const depuis = lireDepuis(location.state);

  if (utilisateur) return <Navigate to={ESPACE_DU_ROLE[utilisateur.role]} replace />;

  const onSubmit = async (data: Formulaire) => {
    setErreur(null);
    try {
      const u = await connecter(data.identifiant, data.motDePasse);
      navigate(depuis ?? ESPACE_DU_ROLE[u.role], { replace: true });
    } catch (err) {
      setErreur(messageConnexion(err));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Carte titre="Connexion">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Champ label="Téléphone ou email" erreur={formState.errors.identifiant?.message}>
            <input className={classeInput} autoComplete="username" placeholder="034 12 345 67" {...register("identifiant")} />
          </Champ>
          <Champ label="Mot de passe" erreur={formState.errors.motDePasse?.message}>
            <input type="password" className={classeInput} autoComplete="current-password" {...register("motDePasse")} />
          </Champ>
          {erreur && <Alerte>{erreur}</Alerte>}
          <Bouton type="submit" enCours={formState.isSubmitting} className="w-full">
            Se connecter
          </Bouton>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link to="/inscription" state={depuis ? { depuis } : undefined} className="font-medium text-emerald-800 hover:underline">
            Créer un compte
          </Link>
        </p>
      </Carte>
    </div>
  );
}
