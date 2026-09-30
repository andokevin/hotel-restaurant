import { prisma } from "../../db.js";
import { NotFound, Conflit } from "@hotel/commun";
import { trouverCategorie } from "../categorie/categorie.service.js";
import type { CreerChambreDTO, FiltreChambre } from "./chambre.schema.js";

export const listerChambres = (filtre: FiltreChambre) =>
  prisma.chambre.findMany({
    where: {
      ...(filtre.etatMenage ? { etatMenage: filtre.etatMenage } : {}),
      ...(filtre.horsService ? { horsService: filtre.horsService === "true" } : {}),
    },
    include: { categorie: true },
    orderBy: { numero: "asc" },
  });

export const trouverChambre = async (id: string) => {
  const chambre = await prisma.chambre.findUnique({
    where: { id },
    include: { categorie: true },
  });
  if (!chambre) throw NotFound("Chambre");
  return chambre;
};

export const creerChambre = async (data: CreerChambreDTO) => {
  await trouverCategorie(data.categorieId);          // 404 clair si elle n'existe pas

  const existante = await prisma.chambre.findUnique({ where: { numero: data.numero } });
  if (existante) throw Conflit(`La chambre ${data.numero} existe déjà`);

  return prisma.chambre.create({ data, include: { categorie: true } });
};