import { z } from "zod";
import { env } from "./config/env.js";
import { AppError } from "@hotel/commun";

const reponseSchema = z.object({ data: z.object({ url: z.url() }) });

type DemandeLien = {
  montant: number;
  description: string;
  clientEmail?: string;
  callbackUrl: string;
  successUrl: string;
  failureUrl: string;
};

export async function creerLienPaiement(d: DemandeLien): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.PAPI_BASE_URL}/clients/payment-form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AuthentificationKey: `Ibonia ${env.PAPI_API_KEY}`,
      },
      body: JSON.stringify({
        amount: d.montant,
        change: { currency: "MGA", rate: 1 },
        successUrl: d.successUrl,
        failureUrl: d.failureUrl,
        callbackUrl: d.callbackUrl,
        clientEmail: d.clientEmail,
        paymentDescription: d.description,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AppError(502, "PAPI_INJOIGNABLE", "Le service de paiement ne répond pas");
  }

  if (!res.ok) {
    throw new AppError(502, "PAPI_ERREUR", `Papi a répondu ${res.status}`);
  }

  const parsed = reponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new AppError(502, "PAPI_REPONSE_INVALIDE", "Réponse inattendue du service de paiement");
  }
  return parsed.data.data.url;
}

export const METHODES_PAPI: Record<number, "MVOLA" | "AIRTEL_MONEY" | "ORANGE_MONEY" | "CARTE"> = {
  2: "MVOLA",
  3: "AIRTEL_MONEY",
  // compléter avec les codes Orange Money et Visa de la documentation Papi
};