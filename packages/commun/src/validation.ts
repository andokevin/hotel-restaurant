import type { Request } from "express";
import { z } from "zod";

const idParamSchema = z.object({ id: z.uuid() });

// Valide `:id` avant qu'il n'atteigne la base : "abc" donne un 400 clair
// au lieu d'une erreur PostgreSQL "invalid input syntax for type uuid".
export const lireId = (req: Request): string => idParamSchema.parse(req.params).id;
