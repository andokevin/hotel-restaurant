import { AppError, NonAutorise, type Role } from "@hotel/commun";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { obtenirHashFactice, verifierMotDePasse } from "../../mot-de-passe.js";
import {
  DUREE_ACCES_SECONDES,
  DUREE_SESSION_MS,
  hacherJeton,
  nouveauJetonSession,
  signerJetonAcces,
} from "../../jetons.js";
import { CHAMPS_PUBLICS } from "../utilisateur/utilisateur.service.js";
import type { ConnexionDTO } from "./session.schema.js";

// Un seul message pour « email inconnu » et « mauvais mot de passe » :
// sinon on dirait à un attaquant quels emails ont un compte.
const IdentifiantsInvalides = () => new AppError(401, "IDENTIFIANTS_INVALIDES", "Email ou mot de passe incorrect");
const SessionInvalide = () => NonAutorise("Session expirée, reconnectez-vous");

type Utilisateur = { id: string; role: Role };

// Ouvre une session : un jeton d'accès (JWT 15 min) + un jeton de rafraîchissement (7 jours).
async function ouvrirSession(utilisateur: Utilisateur) {
  const jetonSession = nouveauJetonSession();
  await prisma.session.create({
    data: {
      utilisateurId: utilisateur.id,
      jetonHash: hacherJeton(jetonSession),
      expireLe: new Date(Date.now() + DUREE_SESSION_MS),
    },
  });
  return {
    jetonSession, // part dans un cookie httpOnly, jamais dans le corps de la réponse
    jetonAcces: await signerJetonAcces(utilisateur),
    expireDans: DUREE_ACCES_SECONDES,
  };
}

export async function connecter({ email, motDePasse }: ConnexionDTO) {
  const u = await prisma.utilisateur.findUnique({ where: { email } });

  if (!u) {
    await verifierMotDePasse(motDePasse, await obtenirHashFactice()); // même durée qu'un vrai compte
    throw IdentifiantsInvalides();
  }
  if (!(await verifierMotDePasse(motDePasse, u.motDePasseHash))) throw IdentifiantsInvalides();
  // Dit seulement APRÈS un mot de passe correct : ne révèle rien à qui ne le connaît pas.
  if (!u.actif) throw new AppError(403, "COMPTE_DESACTIVE", "Ce compte est désactivé");

  const session = await ouvrirSession(u);
  const { motDePasseHash: _hash, updatedAt: _maj, ...utilisateur } = u;
  return { ...session, utilisateur };
}

// Rotation : chaque jeton de rafraîchissement ne sert qu'UNE fois.
// Si un jeton déjà utilisé revient, quelqu'un l'a volé (ou l'a rejoué) : on coupe toutes les sessions.
export async function rafraichir(jetonSession: string | undefined) {
  if (!jetonSession) throw SessionInvalide();

  const session = await prisma.session.findUnique({
    where: { jetonHash: hacherJeton(jetonSession) },
    include: { utilisateur: true },
  });
  if (!session) throw SessionInvalide();

  if (session.revoqueLe) {
    logger.warn({ utilisateurId: session.utilisateurId }, "jeton de rafraîchissement réutilisé : sessions révoquées");
    await prisma.session.updateMany({
      where: { utilisateurId: session.utilisateurId, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    throw SessionInvalide();
  }
  if (session.expireLe < new Date() || !session.utilisateur.actif) throw SessionInvalide();

  // Révocation conditionnelle : si deux requêtes arrivent en même temps avec le même jeton,
  // une seule obtient count = 1. L'autre est refusée.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, revoqueLe: null },
    data: { revoqueLe: new Date() },
  });
  if (count === 0) throw SessionInvalide();

  return ouvrirSession(session.utilisateur);
}

export async function deconnecter(jetonSession: string | undefined) {
  if (!jetonSession) return;
  await prisma.session.updateMany({
    where: { jetonHash: hacherJeton(jetonSession), revoqueLe: null },
    data: { revoqueLe: new Date() },
  });
}

export async function moi(id: string) {
  const u = await prisma.utilisateur.findUnique({ where: { id }, select: CHAMPS_PUBLICS });
  if (!u || !u.actif) throw NonAutorise();
  return u;
}
