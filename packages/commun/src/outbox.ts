import type { Logger } from "pino";
import type { BusEvenements, EvenementStocke } from "./bus.js";
import { lireErreurBase } from "./erreurs-base.js";

// Accès à la table outbox_evenement DU service (chaque service a sa propre base et son propre client Prisma).
export type DepotOutbox = {
  lireEnAttente: (lot: number) => Promise<EvenementStocke[]>;
  marquerPublies: (ids: string[]) => Promise<void>;
};

// Relais : publie les événements en attente, dans l'ordre, puis les marque publiés.
// Si le processus plante entre l'envoi et marquerPublies, les événements seront republiés
// au prochain passage : BullMQ ignore les doublons (jobId = id de l'événement) et les
// consommateurs sont idempotents (table evenement_traite).
export async function relayerOutbox(bus: BusEvenements, depot: DepotOutbox, logger: Logger, lot = 100): Promise<number> {
  const enAttente = await depot.lireEnAttente(lot);
  const publies: string[] = [];
  try {
    for (const evt of enAttente) {
      await bus.publier(evt);
      publies.push(evt.id);
    }
  } catch (err) {
    // Redis indisponible : on marque ce qui est parti, le reste sera repris au prochain passage.
    logger.warn({ err }, "relais outbox interrompu");
  }
  if (publies.length > 0) await depot.marquerPublies(publies);
  return publies.length;
}

// Côté consommateur : l'insertion dans evenement_traite a violé sa clé primaire → événement déjà traité.
// On vérifie le NOM de la contrainte : un P2002 levé par l'effet lui-même est une vraie erreur.
export const estDoublonEvenement = (err: unknown) => lireErreurBase(err)?.contrainte === "evenement_traite_pkey";
