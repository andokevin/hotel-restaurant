import type { Worker } from "@hotel/commun";
import { bus } from "./bus.js";
import { genererTableau, traiterFactureCloturee } from "./comptabilite.service.js";
import { logger } from "./logger.js";

const FILE_TACHES = "comptabilite.taches";

export async function demarrerJobs(): Promise<Worker[]> {
  // BPMN « Chaque jour à 23 h 00 » : job RÉPÉTABLE, fuseau de Madagascar (pas celui du serveur)
  await bus.file(FILE_TACHES).upsertJobScheduler("tableau-de-bord", { pattern: "0 23 * * *", tz: "Indian/Antananarivo" }, { name: "tableau-de-bord" });
  const workers = [
    bus.traiter(FILE_TACHES, () => genererTableau()),
    bus.consommer("comptabilite", "facture.cloturee", traiterFactureCloturee),
  ];
  for (const w of workers) w.on("error", (err) => logger.error({ err, file: w.name }, "erreur de worker"));
  logger.info("jobs BullMQ démarrés");
  return workers;
}
