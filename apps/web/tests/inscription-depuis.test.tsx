import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Connexion } from "../src/pages/public/Connexion";
import { Inscription } from "../src/pages/public/Inscription";

// Ni serveur ni gateway : l'inscription réussit et la connexion renvoie un client.
const { connecter, poster } = vi.hoisted(() => ({
  connecter: vi.fn(),
  poster: vi.fn(),
}));

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({ utilisateur: null, chargement: false, connecter, deconnecter: vi.fn() }),
}));

vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  api: { get: vi.fn(), post: poster, patch: vi.fn() },
}));

// Page d'arrivée : affiche l'URL complète, pour vérifier que la catégorie choisie est conservée.
function Arrivee() {
  const { pathname, search } = useLocation();
  return <p>Arrivé sur {pathname + search}</p>;
}

const afficher = (entree: InitialEntry) =>
  render(
    <MemoryRouter initialEntries={[entree]}>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/client/reserver" element={<Arrivee />} />
      </Routes>
    </MemoryRouter>,
  );

const sInscrire = async () => {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Nom complet"), "Rasoa Be");
  await u.type(screen.getByLabelText("Téléphone"), "034 12 345 67");
  await u.type(screen.getByLabelText("Email"), "rasoa@mail.mg");
  await u.type(screen.getByLabelText("Mot de passe (10 caractères minimum)"), "motdepasse-solide");
  await u.type(screen.getByLabelText("Confirmer le mot de passe"), "motdepasse-solide");
  await u.click(screen.getByRole("button", { name: "Créer mon compte" }));
};

describe("Inscription depuis une chambre choisie (#81)", () => {
  beforeEach(() => {
    connecter.mockReset().mockResolvedValue({ id: "u1", role: "CLIENT" });
    poster.mockReset().mockResolvedValue({});
  });

  it("« Créer un compte » depuis la connexion garde la chambre choisie jusqu'au formulaire de réservation", async () => {
    afficher({ pathname: "/connexion", state: { depuis: "/client/reserver?categorie=SUITE_SENIOR" } });

    await userEvent.setup().click(screen.getByRole("link", { name: "Créer un compte" }));
    await sInscrire();

    expect(await screen.findByText("Arrivé sur /client/reserver?categorie=SUITE_SENIOR")).toBeTruthy();
  });

  it("inscription directe (sans provenance) : formulaire de réservation sans catégorie, comme avant", async () => {
    afficher("/inscription");

    await sInscrire();

    expect(await screen.findByText("Arrivé sur /client/reserver")).toBeTruthy();
  });

  it("une provenance vers un autre site est ignorée (pas de redirection ouverte)", async () => {
    afficher({ pathname: "/inscription", state: { depuis: "//site-pirate.example/client/reserver" } });

    await sInscrire();

    expect(await screen.findByText("Arrivé sur /client/reserver")).toBeTruthy();
  });

  it("le lien « Se connecter » de l'inscription garde aussi la provenance", async () => {
    afficher({ pathname: "/inscription", state: { depuis: "/client/reserver?categorie=STANDARD" } });

    await userEvent.setup().click(screen.getByRole("link", { name: "Se connecter" }));
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Téléphone ou email"), "0341234567");
    await u.type(screen.getByLabelText("Mot de passe"), "motdepasse-solide");
    await u.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Arrivé sur /client/reserver?categorie=STANDARD")).toBeTruthy();
  });
});
