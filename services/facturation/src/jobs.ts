import type { Worker } from "@hotel/commun";
import { bus } from "./bus.js";
import { logger } from "./logger.js";
import { traiterConsommationImputee, traiterReservationCreee, traiterSejourTermine } from "./modules/facture/facture.service.js";
import { FILE_NOTIFICATIONS, traiterNotification } from "./modules/paiement/paiement.service.js";
import { relayerOutbox } from "./outbox.js";

const FILE_TACHES = "facturation.taches";

export async function demarrerJobs(): Promise<Worker[]> {
  await bus.file(FILE_TACHES).upsertJobScheduler("relais-outbox", { every: 2_000 }, { name: "relais-outbox" });

  const workers = [
    bus.traiter(FILE_TACHES, async (job) => {
      if (job.name === "relais-outbox") return relayerOutbox();
      logger.warn({ nom: job.name }, "tâche inconnue");
    }),
    // Notifications Papi, traitées ici et non dans la requête HTTP
    bus.traiter(FILE_NOTIFICATIONS, (job) => traiterNotification(job.data)),
    // Événements venant des autres services
    bus.consommer("facturation", "reservation.creee", traiterReservationCreee),
    bus.consommer("facturation", "sejour.termine", traiterSejourTermine),
    bus.consommer("facturation", "consommation.imputee", traiterConsommationImputee),
  ];

  for (const w of workers) w.on("error", (err) => logger.error({ err, file: w.name }, "erreur de worker"));
  logger.info("jobs BullMQ démarrés");
  return workers;
}
