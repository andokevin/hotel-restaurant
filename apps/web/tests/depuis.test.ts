import { describe, expect, it } from "vitest";
import { lireDepuis } from "../src/auth/depuis";

describe("lireDepuis : page de provenance après connexion ou inscription", () => {
  it("garde un chemin interne, avec ses paramètres", () => {
    expect(lireDepuis({ depuis: "/client/reserver?categorie=STANDARD" })).toBe("/client/reserver?categorie=STANDARD");
  });

  it("refuse un autre site (redirection ouverte)", () => {
    expect(lireDepuis({ depuis: "//site-pirate.example" })).toBeNull();
    expect(lireDepuis({ depuis: "/\\site-pirate.example" })).toBeNull();
    expect(lireDepuis({ depuis: "https://site-pirate.example" })).toBeNull();
  });

  it("sans provenance, ou de forme inattendue : null", () => {
    expect(lireDepuis(null)).toBeNull();
    expect(lireDepuis(undefined)).toBeNull();
    expect(lireDepuis({})).toBeNull();
    expect(lireDepuis({ depuis: 42 })).toBeNull();
  });
});
