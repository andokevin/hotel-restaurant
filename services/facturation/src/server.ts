import { app } from "./app.js";
import { bus } from "./bus.js";
import { env } from "./config/env.js";
import { prisma } from "./db.js";
import { demarrerJobs } from "./jobs.js";
import { logger } from "./logger.js";

const serveur = app.listen(env.PORT, () => {
  logger.info(`facturation-service démarré sur http://localhost:${env.PORT}`);
});

const workers = await demarrerJobs();

// Arrêt propre (Ctrl+C, docker stop) : on termine les jobs en cours avant de couper,
// sinon un job interrompu au milieu serait rejoué (sans dommage, mais inutilement).
const arreter = async (signal: string) => {
  logger.info({ signal }, "arrêt en cours");
  serveur.close();
  await Promise.all(workers.map((w) => w.close()));
  await bus.fermer();
  await prisma.$disconnect();
  process.exit(0);
};
process.once("SIGINT", () => void arreter("SIGINT"));
process.once("SIGTERM", () => void arreter("SIGTERM"));
