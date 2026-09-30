import type { Worker } from "@hotel/commun";
import { bus } from "./bus.js";
import { logger } from "./logger.js";
import { traiterMenageTermine } from "./modules/article/article.service.js";
import { relayerOutbox } from "./outbox.js";

const FILE_TACHES = "stock.taches";

export async function demarrerJobs(): Promise<Worker[]> {
  await bus.file(FILE_TACHES).upsertJobScheduler("relais-outbox", { every: 2_000 }, { name: "relais-outbox" });
  const workers = [bus.traiter(FILE_TACHES, () => relayerOutbox()), bus.consommer("stock", "menage.termine", traiterMenageTermine)];
  for (const w of workers) w.on("error", (err) => logger.error({ err, file: w.name }, "erreur de worker"));
  logger.info("jobs BullMQ démarrés");
  return workers;
}
