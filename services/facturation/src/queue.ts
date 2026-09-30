import { Queue } from "bullmq";
import { env } from "./config/env.js";

const url = new URL(env.REDIS_URL);
export const connexionRedis = {
  host: url.hostname,
  port: Number(url.port),
  maxRetriesPerRequest: null,
};

export type JobCallbackPapi = {
  paiementId: string;
  transactionId: string;
  montant: number;
  status: number;
  errorMessage?: string | null;
  paymentMethod?: number;
};

export const fileCallbacks = new Queue<JobCallbackPapi>("callbacks-papi", {
  connection: connexionRedis,
});

export const ajouterCallback = (data: JobCallbackPapi) =>
  fileCallbacks.add("papi", data, {
    jobId: `papi-${data.transactionId}`,          // même transaction = même job
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });