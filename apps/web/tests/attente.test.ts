import { describe, expect, it } from "vitest";
import { libelleAttente, minutesEcoulees } from "../src/lib/attente";

describe("temps d'attente d'une commande", () => {
  it("minutes entières écoulées, jamais négatives (horloges légèrement décalées)", () => {
    const t = Date.parse("2026-11-05T12:00:00Z");
    expect(minutesEcoulees("2026-11-05T11:47:30Z", t)).toBe(12);
    expect(minutesEcoulees("2026-11-05T12:00:20Z", t)).toBe(0);
  });

  it("libellé lisible en cuisine", () => {
    expect(libelleAttente(0)).toBe("à l'instant");
    expect(libelleAttente(12)).toBe("il y a 12 min");
    expect(libelleAttente(65)).toBe("il y a 1 h 05");
  });
});
