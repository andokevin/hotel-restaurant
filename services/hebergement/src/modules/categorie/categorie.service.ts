import { NotFound } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { CreerCategorieDTO, FiltreCategorie } from "./categorie.schema.js";

// Fonction fléchée SANS accolades : la promesse est renvoyée implicitement.
// (Avec des accolades, il faut écrire `return`, sinon la fonction renvoie undefined.)
// Avec `personnes` : seulement les catégories dont la capacité suffit.
export const listerCategories = (filtre: FiltreCategorie = {}) =>
  prisma.categorieChambre.findMany({
    where: filtre.personnes ? { capacite: { gte: filtre.personnes } } : {},
    orderBy: { tarifNuit: "asc" },
    include: { _count: { select: { chambres: true } } },
  });

export const trouverCategorie = async (id: string) => {
  const categorie = await prisma.categorieChambre.findUnique({ 
    where: { id },
    include: { chambres: { orderBy: { numero: "asc" } } }},
  );
  if (!categorie) throw NotFound("Catégorie");
  return categorie;
};

export const creerCategorie = (data: CreerCategorieDTO) => prisma.categorieChambre.create({ data });
