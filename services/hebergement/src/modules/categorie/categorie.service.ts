import { prisma } from "../../db.js";
import { NotFound } from "../../errors.js";
import type { CreerCategorieDTO} from "./categorie.schema.js"

export const listerCategories = () => {
    prisma.categorieChambre.findMany({
        orderBy: { tarifNuit: "asc" }
    })
}

export const trouverCategorie = async (id: string) => {
  const categorie = await prisma.categorieChambre.findUnique({ where: { id } });
  if (!categorie) throw NotFound("Catégorie");
  return categorie;
};

export const creerCategorie = (data: CreerCategorieDTO) =>
  prisma.categorieChambre.create({ data })