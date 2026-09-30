import type { Worker } from "@hotel/commun";
import { z } from "zod";
import { bus } from "./bus.js";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { traiterMenageTermine } from "./modules/chambre/menage.js";
import { balayerExpirations, expirerReservation, FILE_EXPIRATIONS } from "./modules/reservation/expiration.js";
import { traiterPaiementRecu } from "./modules/reservation/reservation.service.js";
import { relayerOutbox } from "./outbox.js";

const FILE_TACHES = "hebergement.taches";

// Tâches répétables. Un « job scheduler » BullMQ n'existe qu'une fois dans Redis, même si
// plusieurs instances du service démarrent : chaque tâche ne s'exécute qu'une fois à la fois.
async function planifierTachesRepetables(): Promise<void> {
  const taches = bus.file(FILE_TACHES);
  await taches.upsertJobScheduler("relais-outbox", { every: 2_000 }, { name: "relais-outbox" });
  await taches.upsertJobScheduler("balayage-expirations", { every: 60_000 }, { name: "balayage-expirations" });
  await taches.upsertJobScheduler(
    "purge-idempotence",
    { pattern: "0 3 * * *", tz: "Indian/Antananarivo" }, // chaque nuit à 3 h, heure de Madagascar
    { name: "purge-idempotence" },
  );
}

async function purgerClesIdempotence(): Promise<number> {
  const { count } = await prisma.cleIdempotence.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  return count;
}

export async function demarrerJobs(): Promise<Worker[]> {
  await planifierTachesRepetables();

  const workers = [
    bus.traiter(FILE_TACHES, async (job) => {
      if (job.name === "relais-outbox") return relayerOutbox();
      if (job.name === "balayage-expirations") return balayerExpirations();
      if (job.name === "purge-idempotence") return purgerClesIdempotence();
      logger.warn({ nom: job.name }, "tâche inconnue");
    }),
    bus.traiter(FILE_EXPIRATIONS, async (job) => {
      const { reservationId } = z.object({ reservationId: z.uuid() }).parse(job.data);
      return expirerReservation(reservationId);
    }),
    // Événements venant des autres services
    bus.consommer("hebergement", "paiement.recu", traiterPaiementRecu),
    bus.consommer("hebergement", "menage.termine", traiterMenageTermine),
  ];

  for (const w of workers) w.on("error", (err) => logger.error({ err, file: w.name }, "erreur de worker"));
  logger.info("jobs BullMQ démarrés");
  return workers;
}
