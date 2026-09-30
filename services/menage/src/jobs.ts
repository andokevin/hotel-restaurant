import type { Worker } from "@hotel/commun";
import { bus } from "./bus.js";
import { logger } from "./logger.js";
import { traiterSejourCommence, traiterSejourTermine } from "./modules/tache/tache.service.js";
import { relayerOutbox } from "./outbox.js";

const FILE_TACHES = "menage.taches";

export async function demarrerJobs(): Promise<Worker[]> {
  await bus.file(FILE_TACHES).upsertJobScheduler("relais-outbox", { every: 2_000 }, { name: "relais-outbox" });
  const workers = [
    bus.traiter(FILE_TACHES, () => relayerOutbox()),
    bus.consommer("menage", "sejour.commence", traiterSejourCommence),
    bus.consommer("menage", "sejour.termine", traiterSejourTermine),
  ];
  for (const w of workers) w.on("error", (err) => logger.error({ err, file: w.name }, "erreur de worker"));
  logger.info("jobs BullMQ démarrés");
  return workers;
}
