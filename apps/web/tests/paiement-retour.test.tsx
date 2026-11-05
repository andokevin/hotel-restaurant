import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Paiement } from "../src/lib/types";
import { PaiementRetour } from "../src/pages/client/PaiementRetour";

const { lire, poster } = vi.hoisted(() => ({ lire: vi.fn(), poster: vi.fn() }));

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({ utilisateur: { id: "c1", role: "CLIENT" }, chargement: false, connecter: vi.fn(), deconnecter: vi.fn() }),
}));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: lire, post: poster, patch: vi.fn() },
}));

const paiement = (surcharge: Partial<Paiement>): Paiement => ({
  id: "p1",
  factureId: "f1",
  montant: 240_000,
  statut: "ECHOUE",
  methode: "MVOLA",
  facture: { numero: "FAC-2026-000042", statut: "EMISE" },
  ...surcharge,
});

const afficher = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/paiement/retour?paiement=p1&echec=1"]}>
        <Routes>
          <Route path="/paiement/retour" element={<PaiementRetour />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Résultat du paiement : réessayer après un échec (#82)", () => {
  beforeEach(() => {
    lire.mockReset();
    poster.mockReset().mockReturnValue(new Promise(() => {})); // la redirection vers Papi n'a pas lieu
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("échec : bouton « Réessayer le paiement » et lien « Mes réservations »", async () => {
    lire.mockResolvedValue(paiement({ statut: "ECHOUE" }));
    afficher();

    expect(await screen.findByRole("button", { name: "Réessayer le paiement" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mes réservations" }).getAttribute("href")).toBe("/client/reservations");
  });

  it("« Réessayer » demande un NOUVEAU lien pour la même facture (jamais de montant envoyé)", async () => {
    lire.mockResolvedValue(paiement({ statut: "ECHOUE" }));
    afficher();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Réessayer le paiement" }));

    expect(poster).toHaveBeenCalledWith("/paiements", { factureId: "f1" });
  });

  it("paiement réussi : aucun bouton « Réessayer »", async () => {
    lire.mockResolvedValue(paiement({ statut: "REUSSI", facture: { numero: "FAC-2026-000042", statut: "PAYEE" } }));
    afficher();

    expect(await screen.findByText(/Paiement confirmé/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer le paiement" })).toBeNull();
  });

  it("échec, mais la facture a été soldée autrement : pas de « Réessayer »", async () => {
    lire.mockResolvedValue(paiement({ statut: "ECHOUE", facture: { numero: "FAC-2026-000042", statut: "PAYEE" } }));
    afficher();

    expect(await screen.findByText(/a échoué/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer le paiement" })).toBeNull();
  });

  it("toujours en attente après 60 s : bouton « Voir mes réservations »", async () => {
    vi.useFakeTimers();
    lire.mockResolvedValue(paiement({ statut: "EN_ATTENTE" }));
    afficher();

    await act(() => vi.advanceTimersByTimeAsync(61_000));

    expect(screen.getByText(/toujours pas confirmé/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir mes réservations" }).getAttribute("href")).toBe("/client/reservations");
  });
});
