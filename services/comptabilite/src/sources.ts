import { z } from "zod";
import { AppError, EN_TETE_CLE_INTERNE } from "@hotel/commun";
import { env } from "./config/env.js";

// Le timer de 23 h interroge hebergement et stock (REST interne, synchrone).
async function lire<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { [EN_TETE_CLE_INTERNE]: env.CLE_INTERNE }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AppError(502, "SOURCE_INJOIGNABLE", `Service injoignable : ${new URL(url).host}`);
  }
  if (!res.ok) throw new AppError(502, "SOURCE_ERREUR", `${new URL(url).host} a répondu ${res.status}`);
  return schema.parse(await res.json());
}

export const nuiteesVendues = (jour: string) =>
  lire(
    `${env.HEBERGEMENT_URL}/interne/reservations/statistiques?jour=${jour}`,
    z.object({ nuiteesVendues: z.number().int(), repartitionCanaux: z.record(z.string(), z.number().int()) }),
  );

export const sortiesMenage = (jour: string) =>
  lire(
    `${env.STOCK_URL}/interne/sorties-menage?jour=${jour}`,
    z.array(z.object({ code: z.string(), consommationParNuitee: z.number().int(), quantite: z.number().int() })),
  );
