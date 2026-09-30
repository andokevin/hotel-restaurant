import { z } from "zod";
import { AppError, EN_TETE_CLE_INTERNE, RegleMetier } from "@hotel/commun";
import { env } from "./config/env.js";

const enTetes = { [EN_TETE_CLE_INTERNE]: env.CLE_INTERNE, "Content-Type": "application/json" };

// hebergement : « qui occupe la chambre 204 en ce moment ? » (appel SYNCHRONE : le serveur attend la réponse)
const sejourSchema = z.object({ id: z.uuid(), reference: z.string(), clientNom: z.string(), chambre: z.object({ numero: z.string() }) });

export async function sejourEnCours(chambreNumero: string) {
  let res: Response;
  try {
    res = await fetch(`${env.HEBERGEMENT_URL}/interne/reservations/en-cours?chambre=${encodeURIComponent(chambreNumero)}`, {
      headers: enTetes,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new AppError(502, "HEBERGEMENT_INJOIGNABLE", "Service hébergement indisponible");
  }
  if (res.status === 404) throw RegleMetier(`Aucun séjour en cours dans la chambre ${chambreNumero}`);
  if (!res.ok) throw new AppError(502, "HEBERGEMENT_ERREUR", "Service hébergement indisponible");
  return sejourSchema.parse(await res.json());
}

// facturation : créer la facture d'une commande payée au restaurant. Les prix viennent de NOTRE base.
const factureSchema = z.object({ id: z.uuid(), numero: z.string(), montantTotal: z.number().int() });

export type DemandeFactureRestaurant = {
  commandeId: string;
  reference: string;
  clientNom: string;
  lignes: { libelle: string; quantite: number; prixUnitaire: number }[];
};

export async function creerFactureRestaurant(d: DemandeFactureRestaurant) {
  let res: Response;
  try {
    res = await fetch(`${env.FACTURATION_URL}/interne/factures/restaurant`, {
      method: "POST",
      headers: enTetes,
      body: JSON.stringify(d),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new AppError(502, "FACTURATION_INJOIGNABLE", "Service facturation indisponible");
  }
  if (!res.ok) throw new AppError(502, "FACTURATION_ERREUR", `Facturation a répondu ${res.status}`);
  return factureSchema.parse(await res.json());
}
