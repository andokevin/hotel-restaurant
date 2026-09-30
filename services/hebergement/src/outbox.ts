import { lireErreurBase, type ContenuEvenement, type TypeEvenement } from "@hotel/commun";
import { bus } from "./bus.js";
import { prisma } from "./db.js";
import type { Prisma } from "./generated/prisma/client.js";
import { logger } from "./logger.js";

// Écrit un événement DANS la transaction de l'appelant : il existera si et seulement si
// la donnée métier est enregistrée. Aucun appel réseau ici (Redis viendra après, via le relais).
export const ecrireEvenement = <T extends TypeEvenement>(tx: Prisma.TransactionClient, type: T, payload: ContenuEvenement<T>) =>
  tx.outboxEvenement.create({ data: { type, payload } });

// Relais : publie les événements en attente, dans l'ordre, puis les marque publiés.
// Exécuté toutes les 2 secondes par un job répétable (voir jobs.ts).
export async function relayerOutbox(lot = 100): Promise<number> {
  const enAttente = await prisma.outboxEvenement.findMany({
    where: { publieLe: null },
    orderBy: { createdAt: "asc" },
    take: lot,
  });

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

  if (publies.length > 0) {
    // Si le processus plante ICI (après l'envoi, avant cette mise à jour), les événements
    // seront republiés au prochain passage : BullMQ ignore les doublons (jobId = id de l'événement)
    // et les consommateurs sont idempotents (table evenement_traite).
    await prisma.outboxEvenement.updateMany({ where: { id: { in: publies } }, data: { publieLe: new Date() } });
  }
  return publies.length;
}

// Côté consommateur : exécute `effet` une seule fois par événement.
// L'insertion dans evenement_traite et l'effet sont dans la même transaction :
//  - premier passage : insertion OK, effet appliqué, les deux sont validés ensemble ;
//  - doublon : l'insertion viole la clé primaire evenement_traite_pkey, rien n'est appliqué.
export async function traiterUneFois(
  evenementId: string,
  effet: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<"traite" | "doublon"> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.evenementTraite.create({ data: { evenementId } });
      await effet(tx);
    });
    return "traite";
  } catch (err) {
    // On vérifie le NOM de la contrainte : un P2002 levé par l'effet lui-même
    // (autre contrainte d'unicité) est une vraie erreur, pas un doublon d'événement.
    if (lireErreurBase(err)?.contrainte === "evenement_traite_pkey") return "doublon";
    throw err;
  }
}
