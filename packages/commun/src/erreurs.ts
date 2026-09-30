// Erreur "prévue" : on connaît le code HTTP et le message à renvoyer au client.
// Tout ce qui n'est pas une AppError (ni une erreur reconnue) devient un 500.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const NonAutorise = (message = "Authentification requise") =>
  new AppError(401, "NON_AUTORISE", message);

export const NotFound = (quoi: string) => new AppError(404, "NOT_FOUND", `${quoi} introuvable`);

export const Conflit = (message: string) => new AppError(409, "CONFLICT", message);

export const RegleMetier = (message: string) => new AppError(422, "REGLE_METIER", message);
