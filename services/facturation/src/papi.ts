import { z } from "zod";
import { AppError } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import type { MethodePaiement } from "./generated/prisma/client.js";

// Client Papi.mg. API « payment-links », vérifiée dans l'intégration Reclamia en production
// (voir « Rapport D1 » du guide) : POST {base}/dashboard/api/payment-links, en-tête Token.
const CHEMIN = "/dashboard/api/payment-links";
export const MONTANT_MINIMUM = 300; // Ar, minimum imposé par Papi

const reponseSchema = z.object({
  data: z.object({ paymentLink: z.url(), notificationToken: z.string().min(1) }),
});

export type DemandeLien = {
  reference: string; // notre id de paiement : Papi le renvoie dans merchantPaymentReference
  montant: number;
  description: string;
  clientNom: string;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
};

export async function creerLienPaiement(d: DemandeLien): Promise<{ url: string; notificationToken: string }> {
  let res: Response;
  try {
    res = await fetch(`${env.PAPI_BASE_URL}${CHEMIN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Token: env.PAPI_API_KEY },
      body: JSON.stringify({
        clientName: d.clientNom.slice(0, 120),
        amount: d.montant, // entier en Ariary, calculé par NOTRE serveur
        reference: d.reference,
        description: d.description.slice(0, 255),
        notificationUrl: d.notificationUrl,
        successUrl: d.successUrl,
        failureUrl: d.failureUrl,
        ...(d.clientEmail ? { payerEmail: d.clientEmail } : {}),
        ...(d.clientTelephone ? { payerPhone: d.clientTelephone } : {}),
        isTestMode: env.PAPI_MODE_TEST,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    logger.error({ err }, "Papi injoignable");
    throw new AppError(502, "PAPI_INJOIGNABLE", "Le service de paiement ne répond pas, réessayez");
  }

  if (!res.ok) {
    logger.error({ statut: res.status, corps: await res.text().catch(() => "") }, "Papi a refusé la demande de lien");
    throw new AppError(502, "PAPI_ERREUR", "Le service de paiement a refusé la demande");
  }

  const lu = reponseSchema.safeParse(await res.json().catch(() => null));
  if (!lu.success) throw new AppError(502, "PAPI_REPONSE_INVALIDE", "Réponse inattendue du service de paiement");
  return { url: lu.data.data.paymentLink, notificationToken: lu.data.data.notificationToken };
}

// Notification envoyée par Papi. Volontairement PERMISSIVE (comme Reclamia) : sa forme exacte
// n'est pas garantie, et un 400 ferait perdre un vrai paiement. Les vraies vérifications
// (jeton, notificationToken, montant, référence) sont faites dans le worker.
// Texte facultatif : null/absent → undefined. (z.coerce.string() transformerait null en "null" :
// c'est ce qu'a révélé la première vraie notification, qui envoie "message": null.)
const texte = z.preprocess((v) => (v === null || v === undefined ? undefined : String(v)), z.string().optional());

// Forme observée sur une vraie notification (sandbox, 01/10/2026) : paymentStatus, paymentReference,
// merchantPaymentReference, notificationToken, amount, currency, paymentMethod, message (null),
// displayCurrency, estimatedAmount, fee, clientName, description, payerEmail, payerPhone.
export const notificationSchema = z
  .object({
    paymentStatus: texte,
    paymentReference: texte, // id Papi → reference_externe (idempotence)
    merchantPaymentReference: texte, // notre reference (id du paiement)
    notificationToken: texte,
    amount: z.preprocess((v) => (v === null || v === undefined ? undefined : Number(v)), z.number().optional()),
    currency: texte,
    paymentMethod: texte,
    message: texte,
  })
  .loose();

export type NotificationPapi = z.infer<typeof notificationSchema>;

export type IssuePapi = "succes" | "echec" | "en_attente" | "inconnue";

// SUCCESS / PENDING / FAILED selon la doc ; les autres valeurs sont celles que Reclamia tolère.
export function lireStatut(statut: string | undefined): IssuePapi {
  const s = (statut ?? "").toUpperCase();
  if (["SUCCESS", "PAID", "COMPLETED"].includes(s)) return "succes";
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(s)) return "echec";
  if (s === "PENDING") return "en_attente";
  return "inconnue";
}

// Moyens de paiement annoncés par Papi (texte) → notre enum. Inconnu → null (journalisé).
export function lireMethode(methode: string | undefined): MethodePaiement | null {
  switch ((methode ?? "").toUpperCase()) {
    case "MVOLA":
      return "MVOLA";
    case "AIRTEL_MONEY":
    case "ARTEL_MONEY": // ancienne orthographe relevée dans Reclamia
      return "AIRTEL_MONEY";
    case "ORANGE_MONEY":
      return "ORANGE_MONEY";
    case "BRED": // paiement par carte via la banque BRED (à confirmer avec une vraie notification)
    case "CARD":
    case "CARTE":
    case "VISA":
    case "MASTERCARD":
      return "CARTE";
    default:
      return null;
  }
}
