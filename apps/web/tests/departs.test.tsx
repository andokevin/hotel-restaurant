import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Facture, Reservation } from "../src/lib/types";
import { Departs } from "../src/pages/reception/Departs";

const { lire, poster } = vi.hoisted(() => ({ lire: vi.fn(), poster: vi.fn() }));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: lire, post: poster, patch: vi.fn() },
}));

const sejour = (id: string, reference: string, clientNom: string, numero: string): Reservation => ({
  id,
  reference,
  statut: "EN_COURS",
  montantTotal: 240_000,
  dateArrivee: "2026-11-02",
  dateDepart: "2026-11-05",
  clientNom,
  chambre: { numero },
});

const facture = (id: string, reservationId: string, montantPaye: number): Facture => ({
  id,
  numero: `FAC-2026-00000${id.slice(-1)}`,
  type: "SEJOUR",
  statut: montantPaye >= 240_000 ? "PAYEE" : "EMISE",
  montantTotal: 240_000,
  montantPaye,
  clientNom: "Client",
  emiseLe: "2026-11-02T10:00:00Z",
  reservationId,
  lignes: [{ libelle: "STANDARD – 3 nuit(s)", quantite: 1, prixUnitaire: 240_000, montant: 240_000, origine: "HEBERGEMENT" }],
  paiements: [],
});

// Rakoto doit encore 100 000 Ar ; Rasoa a tout payé.
const REPONSES: Record<string, unknown> = {
  "/reservations/departs": [sejour("r1", "RES-2026-000001", "Rakoto", "101"), sejour("r2", "RES-2026-000002", "Rasoa", "102")],
  "/factures?reservationId=r1": [facture("f1", "r1", 140_000)],
  "/factures?reservationId=r2": [facture("f2", "r2", 240_000)],
  "/factures/f1": facture("f1", "r1", 140_000),
};

const afficher = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Departs />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const ligne = async (client: string) => (await screen.findByText(client)).closest("tr") as HTMLElement;

describe("Départs du jour : reste à payer et encaissement sur place (#85)", () => {
  beforeEach(() => {
    lire.mockReset().mockImplementation(async (chemin: string) => {
      if (!(chemin in REPONSES)) throw new Error(`requête inattendue : ${chemin}`);
      return REPONSES[chemin];
    });
    poster.mockReset().mockResolvedValue(facture("f1", "r1", 240_000));
  });

  it("chaque départ affiche le reste à payer de la facture du séjour", async () => {
    afficher();

    expect(await within(await ligne("Rakoto")).findByText(/100\s000 Ar/)).toBeTruthy();
    expect(await within(await ligne("Rasoa")).findByText("Soldée")).toBeTruthy();
  });

  it("« Encaisser » seulement quand il reste à payer", async () => {
    afficher();

    expect(await within(await ligne("Rakoto")).findByRole("button", { name: "Encaisser" })).toBeTruthy();
    await within(await ligne("Rasoa")).findByText("Soldée");
    expect(within(await ligne("Rasoa")).queryByRole("button", { name: "Encaisser" })).toBeNull();
  });

  it("encaisser le reste sans quitter l'écran", async () => {
    afficher();
    const u = userEvent.setup();

    await u.click(await within(await ligne("Rakoto")).findByRole("button", { name: "Encaisser" }));
    const modale = await screen.findByRole("dialog");
    await u.click(await within(modale).findByRole("button", { name: "Encaisser" }));

    expect(poster).toHaveBeenCalledWith("/factures/f1/encaissements", { montant: 100_000 });
  });

  it("check-out avec un reste à payer : avertissement dans la confirmation", async () => {
    afficher();
    const u = userEvent.setup();
    await within(await ligne("Rakoto")).findByText(/100\s000 Ar/);

    await u.click(within(await ligne("Rakoto")).getByRole("button", { name: "Check-out" }));

    expect(within(await screen.findByRole("dialog")).getByText(/Reste à payer : 100\s000 Ar/)).toBeTruthy();
  });

  it("check-out d'un séjour soldé : pas d'avertissement", async () => {
    afficher();
    const u = userEvent.setup();
    await within(await ligne("Rasoa")).findByText("Soldée");

    await u.click(within(await ligne("Rasoa")).getByRole("button", { name: "Check-out" }));

    expect(within(await screen.findByRole("dialog")).queryByText(/Reste à payer/)).toBeNull();
  });
});
