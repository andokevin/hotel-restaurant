// Lit une erreur levée par Prisma 7 (avec l'adapter-pg) et en extrait
// ce qui nous intéresse : le code Prisma, le code PostgreSQL et le nom de la contrainte.
//
// Formes observées (Prisma 7.10 + @prisma/adapter-pg) :
//   unicité        → code P2002, cause.constraint.index = "reservation_reference_key"
//   clé étrangère  → code P2003, cause.constraint.index = "chambre_categorie_id_fkey"
//   EXCLUDE, CHECK → code P2039 (générique), le nom n'apparaît QUE dans cause.originalMessage
//   uuid invalide  → code P2007, cause.originalCode = "22P02"
//   update introuvable → code P2025, pas de cause
//
// On ne peut pas utiliser `instanceof Prisma.PrismaClientKnownRequestError` ici :
// chaque service a son propre client généré. On vérifie donc la forme de l'objet.

export type ErreurBase = {
  prismaCode: string;
  pgCode?: string;
  contrainte?: string;
};

type Cause = {
  originalCode?: unknown;
  originalMessage?: unknown;
  constraint?: { index?: unknown };
};

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function lireErreurBase(err: unknown): ErreurBase | null {
  if (!estObjet(err) || err.name !== "PrismaClientKnownRequestError") return null;
  if (typeof err.code !== "string") return null;

  const meta = estObjet(err.meta) ? err.meta : {};
  const adapter = estObjet(meta.driverAdapterError) ? meta.driverAdapterError : {};
  const cause: Cause = estObjet(adapter.cause) ? adapter.cause : {};

  const pgCode = typeof cause.originalCode === "string" ? cause.originalCode : undefined;

  let contrainte = typeof cause.constraint?.index === "string" ? cause.constraint.index : undefined;
  if (!contrainte && typeof cause.originalMessage === "string") {
    // ex. : violates exclusion constraint "reservation_sans_chevauchement"
    contrainte = /constraint "([^"]+)"/.exec(cause.originalMessage)?.[1];
  }

  return { prismaCode: err.code, pgCode, contrainte };
}
