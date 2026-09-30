import express, { type Request, type RequestHandler, Router } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  AppError,
  creerGestionnaireErreurs,
  EN_TETE_CLE_INTERNE,
  EN_TETE_UTILISATEUR_ID,
  EN_TETE_UTILISATEUR_ROLE,
  Interdit,
  journalRequetes,
  NonAutorise,
} from "@hotel/commun";
import { authentifier } from "./authentification.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { REGLES, type Acces, type NomService } from "./regles.js";

export const app = express();

// Derrière cloudflared (qui tourne sur la même machine), l'IP réelle du client est dans
// X-Forwarded-For. On ne fait confiance à cet en-tête que s'il vient de localhost.
app.set("trust proxy", "loopback");

app.use(helmet());
// credentials: true → le navigateur peut envoyer le cookie de session (rafraîchissement).
app.use(cors({ origin: env.FRONT_URL, credentials: true }));
app.use(journalRequetes(logger));
// ATTENTION : pas de express.json() ici. Le proxy retransmet le flux brut de la requête ;
// si on lisait le corps avant, il serait déjà consommé et le service recevrait un corps vide.

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// 1. On retire les en-têtes « de confiance » envoyés par le client.
//    Sinon, n'importe qui pourrait écrire "x-utilisateur-role: ADMIN" dans sa requête.
app.use((req, _res, next) => {
  delete req.headers[EN_TETE_UTILISATEUR_ID];
  delete req.headers[EN_TETE_UTILISATEUR_ROLE];
  delete req.headers[EN_TETE_CLE_INTERNE];
  next();
});

// 2. Limite de tentatives sur la connexion : un attaquant ne peut pas essayer
//    des milliers de mots de passe (attaque par force brute).
//    Seuls les ÉCHECS comptent : à l'hôtel, tout le personnel sort par la même IP publique ;
//    si les connexions réussies comptaient, dix employés qui arrivent le matin bloqueraient le onzième.
const limiteConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.LIMITE_CONNEXIONS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true, // une réponse < 400 ne compte pas
  handler: (_req, res) => {
    res.status(429).json({ code: "TROP_DE_TENTATIVES", message: "Trop de tentatives, réessayez dans 15 minutes" });
  },
});
app.post("/api/auth/connexion", limiteConnexion);

// 3. Autorisation : chaque requête doit correspondre à une règle de REGLES.
//    On mémorise le service cible de la requête pour l'étape 4.
const serviceCible = new WeakMap<Request, NomService>();

const garde =
  (acces: Acces, service: NomService): RequestHandler =>
  async (req, _res, next) => {
    let identite = null;
    try {
      identite = await authentifier(req.get("authorization"));
    } catch (err) {
      // Sur une route publique, un jeton expiré ne doit pas empêcher de voir les tarifs.
      if (acces !== "PUBLIC") throw err;
    }

    if (acces !== "PUBLIC") {
      if (!identite) throw NonAutorise();
      if (acces !== "CONNECTE" && !acces.includes(identite.role)) throw Interdit();
    }

    if (identite) {
      req.headers[EN_TETE_UTILISATEUR_ID] = identite.id;
      req.headers[EN_TETE_UTILISATEUR_ROLE] = identite.role;
    }
    serviceCible.set(req, service);
    // "router" : sortir du routeur d'autorisation dès la première règle trouvée,
    // pour qu'aucune autre règle ne s'applique à la même requête.
    next("router");
  };

const autorisation = Router();
for (const regle of REGLES) {
  autorisation[regle.methode](regle.chemin, garde(regle.acces, regle.service));
}
app.use("/api", autorisation);

// 4. Transmission au service. La clé interne prouve au service que la requête vient de la gateway.
const proxyVers = (cible: string) =>
  createProxyMiddleware<Request, express.Response>({
    target: cible,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader(EN_TETE_CLE_INTERNE, env.CLE_INTERNE);
      },
      error: (err, _req, res) => {
        logger.error({ err, cible }, "service injoignable");
        // res est un socket pour les WebSockets (non utilisés ici) : on ne répond que sur HTTP.
        if ("status" in res && !res.headersSent) {
          res.status(502).json({ code: "SERVICE_INDISPONIBLE", message: "Service momentanément indisponible" });
        }
      },
    },
  });

const proxies: Record<NomService, RequestHandler> = {
  auth: proxyVers(env.AUTH_URL),
  hebergement: proxyVers(env.HEBERGEMENT_URL),
  facturation: proxyVers(env.FACTURATION_URL),
};

app.use("/api", (req, res, next) => {
  const service = serviceCible.get(req);
  // Aucune règle ne correspond : refus par défaut.
  if (!service) throw new AppError(404, "ROUTE_INCONNUE", "Route inconnue");
  return proxies[service](req, res, next);
});

app.use(creerGestionnaireErreurs({ logger }));
