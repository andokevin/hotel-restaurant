import type { Enveloppe } from "@hotel/commun";
import { logger } from "../../logger.js";
import { traiterUneFois } from "../../outbox.js";

// Consommateur de menage.termine : la chambre nettoyée redevient PROPRE.
// (docs/modele-donnees.md : cet événement remplace la tâche BPMN « Notifier la réceptionniste ».)
export async function traiterMenageTermine(evt: Enveloppe<"menage.termine">): Promise<void> {
  await traiterUneFois(evt.id, async (tx) => {
    const { count } = await tx.chambre.updateMany({
      where: { id: evt.payload.chambreId },
      data: { etatMenage: "PROPRE", version: { increment: 1 } },
    });
    if (count === 0) logger.warn({ chambreId: evt.payload.chambreId }, "menage.termine pour une chambre inconnue");
  });
}
