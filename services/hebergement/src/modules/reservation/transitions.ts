import { RegleMetier } from "@hotel/commun";
import type { StatutReservation } from "../../generated/prisma/client.js";

// Le diagramme d'états de docs/modele-donnees.md, en code.
// Toute transition absente de cette table est refusée.
const TRANSITIONS: Record<StatutReservation, readonly StatutReservation[]> = {
  EN_ATTENTE_PAIEMENT: ["CONFIRMEE", "ANNULEE"], // paiement reçu | expiration ou refus
  CONFIRMEE: ["EN_COURS", "ANNULEE"], // check-in | annulation
  EN_COURS: ["TERMINEE"], // départ
  TERMINEE: [],
  ANNULEE: [],
};

export function verifierTransition(de: StatutReservation, vers: StatutReservation): void {
  if (!TRANSITIONS[de].includes(vers)) {
    throw RegleMetier(`Transition interdite : ${de} → ${vers}`);
  }
}
