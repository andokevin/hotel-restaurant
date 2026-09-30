import { BusEvenements, creerClientRedis } from "@hotel/commun";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

export const bus = new BusEvenements({ redis: creerClientRedis(env.REDIS_URL), prefixe: env.BULLMQ_PREFIXE, logger });
