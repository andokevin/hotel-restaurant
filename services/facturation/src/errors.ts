export class AppError extends Error {
    
    constructor(public readonly statusCode: number,
                public readonly code : string,
                message: string) {
        
        super(message);
    }
}

export const NotFound = (quoi: string) => new AppError(404, "NOT_FOUND", `${quoi} introuvable`);

export const Conflit =  (message: string) => new AppError(409, "CONFLICT", message);

export const RegleMetier = (message: string) => new AppError(422, "REGLE_METIER", message);