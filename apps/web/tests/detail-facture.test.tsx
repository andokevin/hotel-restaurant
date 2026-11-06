import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailFacture } from "../src/components/DetailFacture";
import type { Facture } from "../src/lib/types";

// Espaces insécables de toLocaleString("fr-FR") : on compare sur un texte aux espaces normalisés
const texte = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

const facture: Facture = {
  id: "f1",
  numero: "FAC-2026-000042",
  type: "SEJOUR",
  statut: "EMISE",
  montantTotal: 298_000,
  montantPaye: 0,
  clientNom: "Rakoto Jean",
  emiseLe: "2026-11-07T08:00:00.000Z",
  // Ordre volontairement mélangé : l'API ne garantit pas l'ordre des lignes
  lignes: [
    { libelle: "Restaurant – commande CMD-2026-000007 (1 article(s))", quantite: 1, prixUnitaire: 18_000, montant: 18_000, origine: "RESTAURANT", ordre: 0 },
    { libelle: "STANDARD – Haute saison – 1 nuit(s) du 2030-10-12 au 2030-10-13, chambre 101", quantite: 1, prixUnitaire: 120_000, montant: 120_000, origine: "HEBERGEMENT", ordre: 1 },
    { libelle: "STANDARD – 2 nuit(s) du 2030-10-10 au 2030-10-12, chambre 101", quantite: 2, prixUnitaire: 80_000, montant: 160_000, origine: "HEBERGEMENT", ordre: 0 },
  ],
};

describe("Détail d'une facture : une ligne par groupe de nuitées (#93)", () => {
  it("affiche les 2 lignes d'hébergement dans l'ordre du séjour, puis le restaurant", () => {
    render(<DetailFacture facture={facture} />);

    const lignes = within(screen.getByRole("list", { name: "Lignes de la facture" })).getAllByRole("listitem");
    expect(lignes.map((l) => texte(l))).toEqual([
      expect.stringContaining("2 nuit(s) du 2030-10-10"),
      expect.stringContaining("Haute saison"),
      expect.stringContaining("Restaurant – commande"),
    ]);
  });

  it("chaque ligne montre quantité × prix unitaire et son montant", () => {
    render(<DetailFacture facture={facture} />);

    const [premiere] = within(screen.getByRole("list", { name: "Lignes de la facture" })).getAllByRole("listitem");
    expect(texte(premiere as HTMLElement)).toContain("2 × 80 000 Ar");
    expect(texte(premiere as HTMLElement)).toContain("160 000 Ar");
  });

  it("la saison est mise en évidence sur sa ligne", () => {
    render(<DetailFacture facture={facture} />);

    expect(screen.getByText("Haute saison", { selector: "span" })).toBeTruthy();
  });
});
