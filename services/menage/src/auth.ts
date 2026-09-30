import { z } from "zod";
import { EN_TETE_CLE_INTERNE } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

// Nom de l'employée, pour le snapshot assignee_nom. Si auth ne répond pas, la tâche
// démarre quand même (le nom est un confort, pas une condition).
export async function lireNomEmploye(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.AUTH_URL}/interne/utilisateurs/${id}`, {
      headers: { [EN_TETE_CLE_INTERNE]: env.CLE_INTERNE },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    return z.object({ nom: z.string() }).parse(await res.json()).nom;
  } catch (err) {
    logger.warn({ err, id }, "nom de l'employée indisponible");
    return null;
  }
}
