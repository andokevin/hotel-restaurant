import { pino, type Logger } from "pino";
import { pinoHttp } from "pino-http";

export type { Logger };

// Un logger JSON par service : chaque ligne porte `service`, ce qui permet de
// filtrer quand les logs de tous les services sont mélangés.
export const creerLogger = (service: string): Logger =>
  pino({
    base: { service },
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  });

// Une ligne de log par requête HTTP, avec un identifiant (req.id) repris dans
// tous les logs de cette requête.
export const journalRequetes = (logger: Logger) => pinoHttp({ logger });
