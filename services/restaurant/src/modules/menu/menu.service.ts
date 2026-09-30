import { NotFound } from "@hotel/commun";
import { z } from "zod";
import { prisma } from "../../db.js";
import type { creerMenuSchema, creerPlatSchema, modifierPlatSchema } from "./menu.schema.js";

const ORDRE = ["ENTREE", "PLAT", "DESSERT", "BOISSON"] as const;
const TITRES = { ENTREE: "Entrées", PLAT: "Plats", DESSERT: "Desserts", BOISSON: "Boissons" } as const;
const fr = (json: unknown) => z.object({ fr: z.string() }).catch({ fr: "" }).parse(json).fr;

// Site public : menus actifs, plats disponibles seulement
export const menusPublies = () =>
  prisma.menu.findMany({
    where: { actif: true },
    include: { plats: { where: { disponible: true }, orderBy: [{ categorie: "asc" }, { prix: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });

export const tousLesMenus = () => prisma.menu.findMany({ include: { plats: { orderBy: { categorie: "asc" } } }, orderBy: { createdAt: "desc" } });

export const creerMenu = (data: z.infer<typeof creerMenuSchema>) => prisma.menu.create({ data });

export async function ajouterPlat(menuId: string, data: z.infer<typeof creerPlatSchema>) {
  if (!(await prisma.menu.findUnique({ where: { id: menuId } }))) throw NotFound("Menu");
  return prisma.plat.create({ data: { ...data, menuId } });
}

export async function modifierPlat(id: string, data: z.infer<typeof modifierPlatSchema>) {
  if (!(await prisma.plat.findUnique({ where: { id } }))) throw NotFound("Plat");
  return prisma.plat.update({ where: { id }, data });
}

// Lane Communication : « Publier les menus sur le site web »
export async function publier(id: string, actif: boolean) {
  if (!(await prisma.menu.findUnique({ where: { id } }))) throw NotFound("Menu");
  return prisma.menu.update({ where: { id }, data: { actif } });
}

// Lane Communication : « Publier les menus sur la page Facebook » (décision D7 : texte à copier)
export async function texteFacebook(id: string) {
  const menu = await prisma.menu.findUnique({ where: { id }, include: { plats: { where: { disponible: true } } } });
  if (!menu) throw NotFound("Menu");
  const blocs = ORDRE.map((c) => {
    const plats = menu.plats.filter((p) => p.categorie === c);
    if (plats.length === 0) return "";
    return `${TITRES[c]}\n${plats.map((p) => `• ${fr(p.nom)} — ${p.prix.toLocaleString("fr-FR")} Ar`).join("\n")}`;
  }).filter(Boolean);
  return { texte: `🍽️ ${fr(menu.nom)}\n\n${blocs.join("\n\n")}\n\nRéservez votre table à la réception. Misaotra ! 🇲🇬` };
}
