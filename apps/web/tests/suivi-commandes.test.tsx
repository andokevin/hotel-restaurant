import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Commande, StatutCommande } from "../src/lib/types";
import { SuiviCommandes } from "../src/pages/restaurant/SuiviCommandes";

const { lire } = vi.hoisted(() => ({ lire: vi.fn() }));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: lire, post: vi.fn(), patch: vi.fn() },
}));

const MAINTENANT = new Date("2026-11-05T12:00:00Z").getTime();
const ilYa = (minutes: number) => new Date(MAINTENANT - minutes * 60_000).toISOString();

const commande = (reference: string, statut: StatutCommande, minutes: number): Commande => ({
  id: reference,
  reference,
  canal: "SUR_PLACE",
  tableNumero: 4,
  clientNom: null,
  statut,
  statutPaiement: "NON_PAYEE",
  montantTotal: 30_000,
  lignes: [{ platNom: "Romazava", prixUnitaire: 15_000, quantite: 2 }],
  createdAt: ilYa(minutes),
});

const COMMANDES = [
  commande("CMD-1", "RECUE", 3),
  commande("CMD-2", "EN_PREPARATION", 12),
  commande("CMD-3", "EN_PREPARATION", 20),
  commande("CMD-4", "REMISE", 40),
  commande("CMD-5", "ANNULEE", 50),
];

const afficher = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SuiviCommandes />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const carte = (reference: string) => screen.getByText(reference).closest("section") as HTMLElement;

describe("Suivi des commandes : vue « en cours » pour la cuisine (#83)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: MAINTENANT, shouldAdvanceTime: true });
    lire.mockReset().mockImplementation(async (chemin: string) => {
      const statut = new URLSearchParams(chemin.split("?")[1]).get("statut");
      return statut ? COMMANDES.filter((c) => c.statut === statut) : COMMANDES;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("par défaut, seules les commandes en cours sont affichées (ni remises ni annulées)", async () => {
    afficher();

    expect(await screen.findByText("CMD-1")).toBeTruthy();
    expect(screen.getByText("CMD-2")).toBeTruthy();
    expect(screen.queryByText("CMD-4")).toBeNull();
    expect(screen.queryByText("CMD-5")).toBeNull();
  });

  it("une colonne par étape, avec le nombre de commandes", async () => {
    afficher();
    await screen.findByText("CMD-1");

    expect(screen.getByRole("heading", { name: "Reçues (1)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "En préparation (2)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prêtes (0)" })).toBeTruthy();
  });

  it("chaque commande affiche son temps d'attente ; au-delà de 15 min, elle est signalée en retard", async () => {
    afficher();
    await screen.findByText("CMD-1");

    expect(within(carte("CMD-2")).getByText("il y a 12 min")).toBeTruthy();
    expect(within(carte("CMD-2")).queryByText("En retard")).toBeNull();
    expect(within(carte("CMD-3")).getByText("il y a 20 min")).toBeTruthy();
    expect(within(carte("CMD-3")).getByText("En retard")).toBeTruthy();
  });

  it("le temps d'attente se met à jour sans recharger la page", async () => {
    afficher();
    await screen.findByText("CMD-1");

    await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));

    expect(within(carte("CMD-2")).getByText("il y a 16 min")).toBeTruthy();
    expect(within(carte("CMD-2")).getByText("En retard")).toBeTruthy();
  });

  it("l'historique reste accessible par le filtre (requête au serveur)", async () => {
    afficher();
    await screen.findByText("CMD-1");

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).selectOptions(screen.getByLabelText("Afficher"), "REMISE");

    expect(await screen.findByText("CMD-4")).toBeTruthy();
    expect(screen.queryByText("CMD-1")).toBeNull();
    expect(lire).toHaveBeenCalledWith("/commandes?statut=REMISE");
  });
});
