import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

export const gestionnaireErreurs: ErrorRequestHandler = (err, _req, res, _next) => {
    if(err instanceof ZodError) {
        res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Données invalides",
            details: err.issues.map((i) => ({
                champ: i.path.join("."),
                message: i.message
            }))
        });
        return;
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json({ code: err.code, message: err.message });
        return;
    }

    
  // Erreur PostgreSQL : contrainte d'exclusion violée
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: string }).code;
    const meta = (err as { meta?: { constraint?: string } }).meta;
    if (code === "P2010" || meta?.constraint === "reservation_sans_chevauchement") {
      res.status(409).json({
        code: "CHAMBRE_INDISPONIBLE",
        message: "Cette chambre est déjà réservée sur ces dates",
      });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: "Erreur interne du serveur" });

}