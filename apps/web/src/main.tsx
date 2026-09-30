import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ApiError } from "./lib/api";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // On ne réessaie pas une erreur « métier » (4xx) : seul un problème réseau / serveur mérite un nouvel essai.
      retry: (nbEchecs, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && nbEchecs < 2,
    },
  },
});

const racine = document.getElementById("root");
if (!racine) throw new Error("Élément #root introuvable dans index.html");

createRoot(racine).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
