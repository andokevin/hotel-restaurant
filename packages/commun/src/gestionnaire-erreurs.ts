import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import type { Logger } from "pino";
import { AppError } from "./erreurs.js";
import { lireErreurBase, type ErreurBase } from "./erreurs-base.js";

type Reponse = { status: number; code: string; message: string };

export type OptionsGestionnaire = {
  logger: Logger;
  // Traduction propre à chaque service : nom de contrainte SQL → réponse HTTP.
  // Le paquet commun ne connaît aucune contrainte métier ; c'est le service qui les déclare.
  contraintes?: Record<string, Reponse>;
};

// Réponse par défaut quand le service n'a rien déclaré pour cette contrainte.
function reponseParDefaut(e: ErreurBase): Reponse | null {
  switch (e.prismaCode) {
    case "P2002":
      return { status: 409, code: "DOUBLON", message: "Cette valeur existe déjà" };
    case "P2003":
      return { status: 409, code: "REFERENCE_INVALIDE", message: "Un élément lié n'existe pas" };
    case "P2025":
      return { status: 404, code: "NOT_FOUND", message: "Enregistrement introuvable" };
    case "P2007":
      return { status: 400, code: "VALIDATION_ERROR", message: "Valeur invalide" };
  }
  if (e.pgCode === "23514") {
    return { status: 422, code: "REGLE_METIER", message: "Une règle de cohérence n'est pas respectée" };
  }
  return null;
}

export const creerGestionnaireErreurs = ({ logger, contraintes = {} }: OptionsGestionnaire): ErrorRequestHandler =>
  (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Données invalides",
        details: err.issues.map((i) => ({ champ: i.path.join("."), message: i.message })),
      });
      return;
    }

    if (err instanceof AppError) {
      res.status(err.statusCode).json({ code: err.code, message: err.message });
      return;
    }

    const base = lireErreurBase(err);
    if (base) {
      const reponse = (base.contrainte && contraintes[base.contrainte]) || reponseParDefaut(base);
      if (reponse) {
        res.status(reponse.status).json({ code: reponse.code, message: reponse.message });
        return;
      }
    }

    // Erreur imprévue : on journalise tout, mais on ne renvoie aucun détail au client.
    logger.error({ err, reqId: req.id }, "erreur non gérée");
    res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: "Erreur interne du serveur" });
  };
