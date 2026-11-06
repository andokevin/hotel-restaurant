import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormulaireReservation } from "../src/components/FormulaireReservation";
import { RecapReservation } from "../src/components/RecapReservation";
import { ApiError } from "../src/lib/api";
import type { Categorie, Reservation } from "../src/lib/types";

const { lire, poster } = vi.hoisted(() => ({ lire: vi.fn(), poster: vi.fn() }));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: lire, post: poster, patch: vi.fn() },
}));

const STANDARD: Categorie = { id: "cat-std", code: "STANDARD", libelle: { fr: "Standard" }, capacite: 2, tarifNuit: 80_000 };
const SUITE: Categorie = { id: "cat-suite", code: "SUITE_SENIOR", libelle: { fr: "Suite Senior" }, capacite: 4, tarifNuit: 150_000 };

// Le serveur filtre par capacité : on simule GET /categories?personnes=N
const categoriesPour = (chemin: string) => {
  const n = Number(new URLSearchParams(chemin.split("?")[1] ?? "").get("personnes") ?? 0);
  return [STANDARD, SUITE].filter((c) => c.capacite >= n);
};

const afficher = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FormulaireReservation personnel={false} onCreee={vi.fn()} />
    </QueryClientProvider>,
  );

const categoriesProposees = () =>
  within(screen.getByLabelText("Catégorie de chambre"))
    .getAllByRole("option")
    .map((o) => o.textContent ?? "")
    .filter((t) => !t.includes("Choisir"));

// Remplit les champs obligatoires du client
const remplirClient = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.type(screen.getByLabelText("Nom complet"), "Rakoto Jean");
  await u.type(screen.getByLabelText("Téléphone"), "0341234567");
  await u.type(screen.getByLabelText("Email"), "rakoto@mail.mg");
  await u.type(screen.getByLabelText("Numéro de la pièce"), "101201304405");
};

describe("Réservation : nombre de personnes et capacité (#92)", () => {
  beforeEach(() => {
    lire.mockReset().mockImplementation(async (chemin: string) => categoriesPour(chemin));
    poster.mockReset();
  });

  it("par défaut : 1 adulte, 0 enfant, toutes les catégories assez grandes", async () => {
    afficher();

    expect(((await screen.findByLabelText("Adultes")) as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Enfants") as HTMLInputElement).value).toBe("0");
    expect(lire).toHaveBeenCalledWith("/categories?personnes=1");
    expect(categoriesProposees()).toHaveLength(2);
  });

  it("3 personnes : la catégorie de capacité 2 n'est plus proposée", async () => {
    const u = userEvent.setup();
    afficher();

    await u.clear(await screen.findByLabelText("Adultes"));
    await u.type(screen.getByLabelText("Adultes"), "2");
    await u.clear(screen.getByLabelText("Enfants"));
    await u.type(screen.getByLabelText("Enfants"), "1");

    await vi.waitFor(() => expect(lire).toHaveBeenCalledWith("/categories?personnes=3"));
    await vi.waitFor(() => expect(categoriesProposees()).toEqual([expect.stringContaining("Suite Senior")]));
  });

  it("envoie nbAdultes et nbEnfants au serveur", async () => {
    const u = userEvent.setup();
    poster.mockReturnValue(new Promise(() => {}));
    afficher();

    await u.selectOptions(await screen.findByLabelText("Catégorie de chambre"), "cat-suite");
    await u.clear(screen.getByLabelText("Enfants"));
    await u.type(screen.getByLabelText("Enfants"), "2");
    await remplirClient(u);
    await u.click(screen.getByRole("button", { name: "Réserver" }));

    await vi.waitFor(() =>
      expect(poster).toHaveBeenCalledWith("/reservations", expect.objectContaining({ nbAdultes: 1, nbEnfants: 2 }), expect.anything()),
    );
  });

  it("refus 422 du serveur (capacité dépassée) : le message s'affiche sous les personnes", async () => {
    const u = userEvent.setup();
    poster.mockRejectedValue(
      new ApiError(422, "REGLE_METIER", "Cette catégorie accueille 2 personnes au maximum (demande : 3 personnes)"),
    );
    afficher();

    await u.selectOptions(await screen.findByLabelText("Catégorie de chambre"), "cat-std");
    await remplirClient(u);
    await u.click(screen.getByRole("button", { name: "Réserver" }));

    const groupe = screen.getByRole("group", { name: "Personnes" });
    expect(await within(groupe).findByText(/accueille 2 personnes au maximum/)).toBeTruthy();
  });

  it("le récapitulatif affiche le nombre de personnes", () => {
    const r: Reservation = {
      id: "r1",
      reference: "RES-2026-000001",
      statut: "CONFIRMEE",
      montantTotal: 240_000,
      dateArrivee: "2030-10-10",
      dateDepart: "2030-10-13",
      nbAdultes: 2,
      nbEnfants: 1,
    };
    render(<RecapReservation reservation={r} />);

    expect(screen.getByText("2 adultes, 1 enfant")).toBeTruthy();
  });
});
