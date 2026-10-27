import {
  estDoublonEvenement,
  relayerOutbox as relayer,
  verifierContenu,
  type ContenuEvenement,
  type TypeEvenement,
} from "@hotel/commun";
import { bus } from "./bus.js";
import { prisma } from "./db.js";
import type { Prisma } from "./generated/prisma/client.js";
import { logger } from "./logger.js";

// Écrit un événement DANS la transaction de l'appelant : il existera si et seulement si
// la donnée métier est enregistrée. Aucun appel réseau ici (Redis viendra après, via le relais).
// Contenu contraire au contrat : erreur, donc la transaction métier est annulée.
export const ecrireEvenement = <T extends TypeEvenement>(tx: Prisma.TransactionClient, type: T, payload: ContenuEvenement<T>) => {
  verifierContenu(type, payload);
  return tx.outboxEvenement.create({ data: { type, payload } });
};

// Relais (job toutes les 2 s) : la boucle est dans @hotel/commun, l'accès à NOTRE table ici.
export const relayerOutbox = (lot = 100) =>
  relayer(
    bus,
    {
      lireEnAttente: (n) => prisma.outboxEvenement.findMany({ where: { publieLe: null }, orderBy: { createdAt: "asc" }, take: n }),
      marquerPublies: async (ids) => {
        await prisma.outboxEvenement.updateMany({ where: { id: { in: ids } }, data: { publieLe: new Date() } });
      },
    },
    logger,
    lot,
  );

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
    if (estDoublonEvenement(err)) return "doublon";
    throw err;
  }
}
