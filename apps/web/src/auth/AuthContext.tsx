import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, definirJeton, quandSessionExpiree, rafraichirSession } from "../lib/api";
import type { ReponseConnexion, Utilisateur } from "../lib/types";

type EtatAuth = {
  utilisateur: Utilisateur | null;
  // true tant qu'on essaie de restaurer la session au démarrage
  chargement: boolean;
  connecter: (identifiant: string, motDePasse: string) => Promise<Utilisateur>;
  deconnecter: () => Promise<void>;
};

const AuthContext = createContext<EtatAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const queryClient = useQueryClient();

  // Oublie tout ce qui concerne l'ancien utilisateur (jeton + données en cache).
  const oublierSession = useCallback(() => {
    definirJeton(null);
    setUtilisateur(null);
    queryClient.clear();
  }, [queryClient]);

  // Au démarrage : le jeton n'est qu'en mémoire, il est donc perdu à chaque rechargement.
  // On tente de le récupérer grâce au cookie de session, puis on charge l'utilisateur.
  useEffect(() => {
    let annule = false;
    const restaurer = async () => {
      try {
        if (await rafraichirSession()) {
          const moi = await api.get<Utilisateur>("/auth/moi");
          if (!annule) setUtilisateur(moi);
        }
      } catch {
        // pas de session valide : l'utilisateur reste déconnecté
      } finally {
        if (!annule) setChargement(false);
      }
    };
    void restaurer();
    return () => {
      annule = true;
    };
  }, []);

  // Si un rafraîchissement échoue en cours d'utilisation, on repasse en « déconnecté » ;
  // les routes protégées redirigent alors vers /connexion.
  useEffect(() => {
    quandSessionExpiree(oublierSession);
  }, [oublierSession]);

  const connecter = useCallback(async (identifiant: string, motDePasse: string) => {
    const rep = await api.post<ReponseConnexion>("/auth/connexion", { identifiant, motDePasse });
    definirJeton(rep.jetonAcces);
    setUtilisateur(rep.utilisateur);
    return rep.utilisateur;
  }, []);

  const deconnecter = useCallback(async () => {
    try {
      await api.post<void>("/auth/deconnexion");
    } finally {
      oublierSession();
    }
  }, [oublierSession]);

  const valeur = useMemo(
    () => ({ utilisateur, chargement, connecter, deconnecter }),
    [utilisateur, chargement, connecter, deconnecter],
  );
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth(): EtatAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
