import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";
import {
  ABONNEMENTS,
  estEnveloppe,
  estTypeEvenement,
  nomFile,
  type Consommateur,
  type Enveloppe,
  type TypeEvenement,
} from "./evenements.js";

// BullMQ 6 ne charge plus ioredis tout seul dans un module ESM : on construit le client
// nous-mêmes et on le passe aux files et aux workers (qui le dupliquent pour leurs
// connexions bloquantes).
// maxRetriesPerRequest: null est obligatoire pour les workers : ils attendent Redis
// indéfiniment au lieu d'échouer au premier incident réseau.
export const creerClientRedis = (url: string): Redis => new Redis(url, { maxRetriesPerRequest: null });

export type OptionsBus = {
  redis: Redis;
  // Espace de noms dans Redis : les tests utilisent un préfixe à part pour ne pas toucher les vraies files.
  prefixe: string;
  logger: Logger;
};

// Ligne de la table outbox_evenement, telle que lue par le service
export type EvenementStocke = { id: string; type: string; payload: unknown; createdAt: Date };

export class BusEvenements {
  private readonly files = new Map<string, Queue>();

  constructor(private readonly options: OptionsBus) {}

  file(nom: string): Queue {
    let f = this.files.get(nom);
    if (!f) {
      f = new Queue(nom, { connection: this.options.redis, prefix: this.options.prefixe });
      this.files.set(nom, f);
    }
    return f;
  }

  // Dépose l'événement dans la file de chacun de ses abonnés.
  // jobId = id de l'événement : si le relais le publie deux fois (plantage entre l'envoi et
  // la mise à jour de publie_le), BullMQ ignore le doublon.
  async publier(evt: EvenementStocke): Promise<void> {
    if (!estTypeEvenement(evt.type)) throw new Error(`Type d'événement inconnu : ${evt.type}`);
    const enveloppe = { id: evt.id, type: evt.type, emisLe: evt.createdAt.toISOString(), payload: evt.payload };
    for (const consommateur of ABONNEMENTS[evt.type]) {
      await this.file(nomFile(consommateur, evt.type)).add(evt.type, enveloppe, {
        jobId: evt.id,
        attempts: 8,
        backoff: { type: "exponential", delay: 2_000 }, // 2 s, 4 s, 8 s… jusqu'à ~4 min
        removeOnComplete: 1_000,
        removeOnFail: false, // un événement en échec définitif reste visible pour enquête
      });
    }
  }

  // Worker d'un consommateur. Le contenu est validé avant d'appeler `traiter` :
  // un message mal formé ne sera jamais bon, inutile de le réessayer.
  consommer<T extends TypeEvenement>(
    consommateur: Consommateur,
    type: T,
    traiter: (evt: Enveloppe<T>) => Promise<void>,
  ): Worker {
    const worker = new Worker(
      nomFile(consommateur, type),
      async (job: Job) => {
        const donnees: unknown = job.data;
        if (!estEnveloppe(type, donnees)) throw new UnrecoverableError(`Événement ${type} invalide`);
        await traiter(donnees);
      },
      { connection: this.options.redis, prefix: this.options.prefixe },
    );
    worker.on("failed", (job, err) =>
      this.options.logger.error({ err, jobId: job?.id, type, tentative: job?.attemptsMade }, "traitement d'événement en échec"),
    );
    return worker;
  }

  // Worker d'une file interne du service (expirations, tâches répétables…).
  // Les services passent par le bus plutôt que d'importer BullMQ : une seule version, une seule connexion.
  traiter(nom: string, processeur: (job: Job) => Promise<unknown>): Worker {
    const worker = new Worker(nom, processeur, { connection: this.options.redis, prefix: this.options.prefixe });
    worker.on("failed", (job, err) =>
      this.options.logger.error({ err, jobId: job?.id, file: nom, tentative: job?.attemptsMade }, "job en échec"),
    );
    return worker;
  }

  // Ferme les files, puis le client Redis : BullMQ ne ferme jamais un client qu'on lui a prêté.
  async fermer(): Promise<void> {
    await Promise.all([...this.files.values()].map((f) => f.close()));
    this.files.clear();
    if (this.options.redis.status !== "end") await this.options.redis.quit();
  }
}
