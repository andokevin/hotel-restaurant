import { lireErreurBase, NotFound, type Enveloppe, type Identite } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { ecrireEvenement } from "../../outbox.js";
import type { CreerArticleDTO, MouvementManuelDTO } from "./article.schema.js";

export const listerArticles = async () =>
  (await prisma.article.findMany({ orderBy: { code: "asc" } })).map((a) => ({ ...a, enAlerte: a.quantite <= a.seuilAlerte }));

export const creerArticle = (data: CreerArticleDTO) => prisma.article.create({ data });

export const historique = async (articleId: string) => {
  if (!(await prisma.article.findUnique({ where: { id: articleId } }))) throw NotFound("Article");
  return prisma.mouvement.findMany({ where: { articleId }, orderBy: { createdAt: "desc" }, take: 200 });
};

// Modifie la quantité de façon ATOMIQUE (règle du modèle : jamais « lire puis écrire »).
// increment/decrement → UPDATE article SET quantite = quantite ± n, calculé par PostgreSQL ;
// la contrainte stock_jamais_negatif refuse une sortie qui ferait passer le stock sous zéro.
async function bougerStock(tx: Prisma.TransactionClient, articleId: string, type: "ENTREE" | "SORTIE", quantite: number) {
  const a = await tx.article.update({
    where: { id: articleId },
    data: { quantite: type === "ENTREE" ? { increment: quantite } : { decrement: quantite } },
  });
  // Franchissement du seuil (et seulement le franchissement : pas une alerte à chaque sortie).
  // Le décrément étant atomique, « avant » = après + quantité, sans relire.
  const avant = a.quantite + quantite;
  if (type === "SORTIE" && avant > a.seuilAlerte && a.quantite <= a.seuilAlerte) {
    await ecrireEvenement(tx, "stock.seuil_atteint", { articleId: a.id, code: a.code, quantite: a.quantite, seuilAlerte: a.seuilAlerte });
    logger.warn({ code: a.code, quantite: a.quantite }, "seuil d'alerte atteint : réapprovisionner");
  }
  return a;
}

export async function mouvementManuel(articleId: string, m: MouvementManuelDTO, identite: Identite) {
  return prisma.$transaction(async (tx) => {
    if (!(await tx.article.findUnique({ where: { id: articleId } }))) throw NotFound("Article");
    await tx.mouvement.create({ data: { articleId, type: m.type, motif: m.motif, quantite: m.quantite, effectuePar: identite.id } });
    return bougerStock(tx, articleId, m.type, m.quantite);
  });
}

// Consommateur de menage.termine (tâche BPMN « Remplacer les articles ») : sortie des articles RÉELLEMENT remplacés.
// Chaque article a SA transaction : un article en rupture n'empêche pas d'enregistrer les autres.
// L'idempotence vient de UNIQUE (reference_id = tâche, article_id) : un événement rejoué ne sort rien deux fois.
export async function traiterMenageTermine(evt: Enveloppe<"menage.termine">): Promise<void> {
  const p = evt.payload;
  for (const { code, quantite } of p.articles) {
    if (quantite === 0) continue;
    const article = await prisma.article.findUnique({ where: { code } });
    if (!article) {
      logger.warn({ code, tacheId: p.tacheId }, "article inconnu déclaré par le ménage : ignoré");
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.mouvement.create({
          data: { articleId: article.id, type: "SORTIE", motif: "MENAGE", quantite, referenceId: p.tacheId, chambreNumero: p.chambreNumero },
        });
        await bougerStock(tx, article.id, "SORTIE", quantite);
      });
    } catch (err) {
      const contrainte = lireErreurBase(err)?.contrainte;
      if (contrainte === "mouvement_reference_id_article_id_key") continue; // déjà sorti : événement rejoué
      if (contrainte === "stock_jamais_negatif") {
        // Les articles ont été posés dans la chambre, mais le stock enregistré dit qu'il n'y en a plus :
        // le stock réel et le stock en base divergent. On le signale (le contrôle de 23 h le verra aussi).
        logger.error({ code, quantite, stock: article.quantite, tacheId: p.tacheId }, "sortie impossible : stock insuffisant en base");
        continue;
      }
      throw err; // erreur passagère : BullMQ réessaiera (les articles déjà sortis ne le seront pas deux fois)
    }
  }
}

// Pour la comptabilité (appel interne) : les sorties MENAGE d'une journée, heure de Madagascar.
export async function sortiesMenageDuJour(jour: string) {
  const debut = new Date(`${jour}T00:00:00+03:00`);
  const fin = new Date(debut.getTime() + 24 * 60 * 60 * 1000);
  const lignes = await prisma.mouvement.groupBy({
    by: ["articleId"],
    where: { motif: "MENAGE", type: "SORTIE", createdAt: { gte: debut, lt: fin } },
    _sum: { quantite: true },
  });
  const articles = await prisma.article.findMany();
  return articles.map((a) => ({
    code: a.code,
    consommationParNuitee: a.consommationParNuitee,
    quantite: lignes.find((l) => l.articleId === a.id)?._sum.quantite ?? 0,
  }));
}
