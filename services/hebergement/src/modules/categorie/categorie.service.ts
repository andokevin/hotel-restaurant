import { NotFound } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { CreerCategorieDTO } from "./categorie.schema.js";

// Fonction fléchée SANS accolades : la promesse est renvoyée implicitement.
// (Avec des accolades, il faut écrire `return`, sinon la fonction renvoie undefined.)
export const listerCategories = () =>
  prisma.categorieChambre.findMany({ orderBy: { tarifNuit: "asc" } });

export const trouverCategorie = async (id: string) => {
  const categorie = await prisma.categorieChambre.findUnique({ where: { id } });
  if (!categorie) throw NotFound("Catégorie");
  return categorie;
};

export const creerCategorie = (data: CreerCategorieDTO) => prisma.categorieChambre.create({ data });
