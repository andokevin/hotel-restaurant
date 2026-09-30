import { importSPKI, jwtVerify } from "jose";
import { z } from "zod";
import { JWT_ALGORITHME, JWT_AUDIENCE, JWT_EMETTEUR, NonAutorise, ROLES, type Identite } from "@hotel/commun";
import { env } from "./config/env.js";

const clePublique = importSPKI(Buffer.from(env.JWT_CLE_PUBLIQUE, "base64").toString("utf8"), JWT_ALGORITHME);

const contenuSchema = z.object({ sub: z.uuid(), role: z.enum(ROLES) });

// Lit "Authorization: Bearer <jwt>".
//  - pas d'en-tête          → null (visiteur anonyme)
//  - jeton invalide/expiré  → erreur 401
//  - jeton valide           → { id, role }
export async function authentifier(autorisation: string | undefined): Promise<Identite | null> {
  if (!autorisation) return null;

  const [schema, jeton] = autorisation.split(" ");
  if (schema !== "Bearer" || !jeton) throw NonAutorise("En-tête Authorization mal formé");

  try {
    // jwtVerify contrôle la signature, l'expiration (exp), l'émetteur (iss) et l'audience (aud).
    // `algorithms` est imposé : un jeton qui annonce "alg: none" ou HS256 est rejeté.
    const { payload } = await jwtVerify(jeton, await clePublique, {
      issuer: JWT_EMETTEUR,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALGORITHME],
    });
    const { sub, role } = contenuSchema.parse(payload);
    return { id: sub, role };
  } catch {
    throw NonAutorise("Jeton invalide ou expiré");
  }
}
