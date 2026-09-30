import { NotFound } from "@hotel/commun";
import { prisma } from "../../db.js";
import { hacherMotDePasse } from "../../mot-de-passe.js";
import type { CreationUtilisateurDTO, InscriptionDTO, MiseAJourUtilisateurDTO } from "./utilisateur.schema.js";

// Les seuls champs qui sortent du service : le hash du mot de passe ne quitte jamais la base.
export const CHAMPS_PUBLICS = {
  id: true,
  email: true,
  nomComplet: true,
  role: true,
  actif: true,
  createdAt: true,
} as const;

export const inscrire = async (data: InscriptionDTO) =>
  prisma.utilisateur.create({
    data: {
      email: data.email,
      nomComplet: data.nomComplet,
      motDePasseHash: await hacherMotDePasse(data.motDePasse),
      role: "CLIENT",
    },
    select: CHAMPS_PUBLICS,
  });

export const creerUtilisateur = async (data: CreationUtilisateurDTO) =>
  prisma.utilisateur.create({
    data: {
      email: data.email,
      nomComplet: data.nomComplet,
      motDePasseHash: await hacherMotDePasse(data.motDePasse),
      role: data.role,
    },
    select: CHAMPS_PUBLICS,
  });

export const listerUtilisateurs = () =>
  prisma.utilisateur.findMany({ select: CHAMPS_PUBLICS, orderBy: { createdAt: "desc" } });

export const trouverUtilisateur = async (id: string) => {
  const u = await prisma.utilisateur.findUnique({ where: { id }, select: CHAMPS_PUBLICS });
  if (!u) throw NotFound("Utilisateur");
  return u;
};

export const mettreAJourUtilisateur = async (id: string, data: MiseAJourUtilisateurDTO) => {
  await trouverUtilisateur(id);
  return prisma.$transaction(async (tx) => {
    const u = await tx.utilisateur.update({ where: { id }, data, select: CHAMPS_PUBLICS });
    // Compte désactivé ou rôle changé : on coupe ses sessions. Son jeton d'accès reste
    // valable au plus 15 minutes, mais il ne pourra plus le renouveler.
    if (data.actif === false || data.role !== undefined) {
      await tx.session.updateMany({ where: { utilisateurId: id, revoqueLe: null }, data: { revoqueLe: new Date() } });
    }
    return u;
  });
};
