import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../src/components/Layout";
import type { Anomalie, Role } from "../src/lib/types";
import { Anomalies } from "../src/pages/comptable/Anomalies";

const { lire, poster, role } = vi.hoisted(() => ({ lire: vi.fn(), poster: vi.fn(), role: { valeur: "COMPTABLE" as string } }));

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({ utilisateur: { id: "u1", nom: "Compta", role: role.valeur }, chargement: false, connecter: vi.fn(), deconnecter: vi.fn() }),
}));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: lire, post: poster, patch: vi.fn() },
}));

const anomalie = (id: string, situation: Anomalie["situation"]): Anomalie => ({
  id,
  montant: 240_000,
  montantRecu: 240_000,
  methode: "MVOLA",
  referenceExterne: `papi-${id}`,
  raison: situation === "A_REMBOURSER" ? "Facture déjà soldée : paiement en trop" : "Argent reçu sur un lien remplacé ou refusé",
  createdAt: "2026-11-07T08:00:00.000Z",
  situation,
  facture: {
    id: `f-${id}`,
    numero: `FAC-2026-00004${id.slice(-1)}`,
    clientNom: "Rakoto Jean",
    clientTelephone: "0341234567",
    clientEmail: "rakoto@mail.mg",
    statut: situation === "A_REMBOURSER" ? "PAYEE" : "EMISE",
    montantTotal: 240_000,
    montantPaye: situation === "A_REMBOURSER" ? 240_000 : 0,
    resteAPayer: situation === "A_REMBOURSER" ? 0 : 240_000,
    paiements: [
      { id: "esp", montant: 240_000, statut: "REUSSI", methode: "ESPECES", createdAt: "2026-11-07T07:00:00.000Z", erreur: null },
      { id, montant: 240_000, statut: "ANOMALIE", methode: "MVOLA", createdAt: "2026-11-07T08:00:00.000Z", erreur: "en trop" },
    ],
  },
});

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const afficherPage = () =>
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <Anomalies />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const afficherMenu = (r: Role) => {
  role.valeur = r;
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Écran des anomalies de paiement (#95)", () => {
  beforeEach(() => {
    role.valeur = "COMPTABLE";
    lire.mockReset().mockResolvedValue([anomalie("a1", "A_REMBOURSER"), anomalie("a2", "A_ACCEPTER")]);
    poster.mockReset().mockResolvedValue({});
  });

  it("liste chaque anomalie avec sa situation, la référence Papi et tous les paiements de la facture", async () => {
    afficherPage();

    const cartes = await screen.findAllByRole("article");
    expect(cartes).toHaveLength(2);
    const premiere = within(cartes[0] as HTMLElement);
    expect(premiere.getByText("À rembourser")).toBeTruthy();
    expect(premiere.getByText("papi-a1")).toBeTruthy();
    expect(premiere.getByText(/Facture déjà soldée/)).toBeTruthy();
    expect(premiere.getAllByRole("listitem")).toHaveLength(2); // l'espèce ET l'anomalie
  });

  it("« Accepter ce paiement » n'est proposé que si la facture attend encore cet argent", async () => {
    afficherPage();

    const [aRembourser, aAccepter] = await screen.findAllByRole("article");
    expect(within(aRembourser as HTMLElement).queryByRole("button", { name: "Accepter ce paiement" })).toBeNull();
    expect(within(aAccepter as HTMLElement).getByRole("button", { name: "Accepter ce paiement" })).toBeTruthy();
  });

  it("marquer remboursé : confirmation avec commentaire OBLIGATOIRE, puis envoi", async () => {
    const u = userEvent.setup();
    afficherPage();

    const [premiere] = await screen.findAllByRole("article");
    await u.click(within(premiere as HTMLElement).getByRole("button", { name: "Marquer remboursé" }));
    const modale = within(screen.getByRole("dialog"));

    await u.click(modale.getByRole("button", { name: "Confirmer le remboursement" }));
    expect(poster).not.toHaveBeenCalled();
    expect(modale.getByText(/commentaire est obligatoire/)).toBeTruthy();

    await u.type(modale.getByLabelText("Commentaire"), "Remboursé le 07/11 dans le tableau de bord Papi");
    await u.click(modale.getByRole("button", { name: "Confirmer le remboursement" }));
    expect(poster).toHaveBeenCalledWith("/paiements/a1/rembourse", { commentaire: "Remboursé le 07/11 dans le tableau de bord Papi" });
  });

  it("accepter : envoie l'action « accepter » avec le commentaire", async () => {
    const u = userEvent.setup();
    afficherPage();

    const [, deuxieme] = await screen.findAllByRole("article");
    await u.click(within(deuxieme as HTMLElement).getByRole("button", { name: "Accepter ce paiement" }));
    const modale = within(screen.getByRole("dialog"));
    await u.type(modale.getByLabelText("Commentaire"), "Le client n'a payé qu'une fois");
    await u.click(modale.getByRole("button", { name: "Confirmer et encaisser" }));

    expect(poster).toHaveBeenCalledWith("/paiements/a2/accepter", { commentaire: "Le client n'a payé qu'une fois" });
  });

  it("aucune anomalie : message rassurant", async () => {
    lire.mockResolvedValue([]);
    afficherPage();

    expect(await screen.findByText(/Aucune anomalie à traiter/)).toBeTruthy();
  });

  it("menu du comptable : lien « Anomalies » avec le nombre à traiter", async () => {
    afficherMenu("COMPTABLE");

    const lien = (await screen.findAllByRole("link", { name: /Anomalies/ }))[0] as HTMLElement;
    expect(lien.getAttribute("href")).toBe("/comptable/anomalies");
    await vi.waitFor(() => expect(within(lien).getByText("2")).toBeTruthy());
  });

  it("un réceptionniste ou un client ne voit ni le lien ni le badge, et rien n'est demandé au serveur", () => {
    for (const r of ["RECEPTIONNISTE", "CLIENT"] as const) {
      const { unmount } = afficherMenu(r);
      expect(screen.queryByRole("link", { name: /Anomalies/ })).toBeNull();
      unmount();
    }
    expect(lire).not.toHaveBeenCalledWith("/paiements/anomalies");
  });
});
