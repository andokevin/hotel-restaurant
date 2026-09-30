import { aujourdhuiMadagascar, NotFound, RegleMetier, type Enveloppe } from "@hotel/commun";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { traiterUneFois } from "./outbox.js";
import { nuiteesVendues, sortiesMenage } from "./sources.js";

const veille = (jour: string) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Bornes d'une journée à Madagascar (UTC+3)
const bornes = (jour: string) => {
  const debut = new Date(`${jour}T00:00:00+03:00`);
  return { gte: debut, lt: new Date(debut.getTime() + 24 * 60 * 60 * 1000) };
};

// Consommateur de facture.cloturee : BPMN « Copie de facture » + « Consommations restaurant incluses ? → Reverser la part restaurant ».
export async function traiterFactureCloturee(evt: Enveloppe<"facture.cloturee">): Promise<void> {
  const f = evt.payload;
  const somme = (origine: string) => f.lignes.filter((l) => l.origine === origine).reduce((s, l) => s + l.montant, 0);
  const montantRestaurant = somme("RESTAURANT");

  await traiterUneFois(evt.id, async (tx) => {
    await tx.copieFacture.upsert({
      where: { factureId: f.factureId },
      update: {},
      create: {
        factureId: f.factureId,
        numero: f.numero,
        type: f.type,
        clientNom: f.clientNom,
        montantTotal: f.montantTotal,
        montantHebergement: somme("HEBERGEMENT"),
        montantRestaurant,
        clotureeLe: new Date(f.clotureeLe),
        lignes: f.lignes,
      },
    });
    // L'argent des consommations imputées à la chambre a été encaissé par l'HÔTEL, mais il appartient
    // au RESTAURANT (origine = RESTAURANT) : on le lui doit. Une facture RESTAURANT, elle, a été
    // encaissée directement au restaurant : rien à reverser.
    if (f.type === "SEJOUR" && montantRestaurant > 0) {
      await tx.reversement.create({ data: { factureId: f.factureId, numeroFacture: f.numero, montant: montantRestaurant } });
    }
  });
}

// BPMN « Chaque jour à 23 h 00 » → compter les factures, comparer chambres vendues / articles, générer le tableau de bord.
// Recalculable : relancer pour un jour écrase le résultat précédent (upsert).
export async function genererTableau(jour: string = aujourdhuiMadagascar()) {
  if (jour > aujourdhuiMadagascar()) throw RegleMetier("Impossible de générer le tableau d'un jour futur");

  // Appels réseau AVANT toute transaction
  const [ventes, ventesVeille, sorties] = await Promise.all([nuiteesVendues(jour), nuiteesVendues(veille(jour)), sortiesMenage(jour)]);

  const copies = await prisma.copieFacture.findMany({ where: { clotureeLe: bornes(jour) } });
  // Les articles remplacés AUJOURD'HUI par le ménage sont ceux utilisés pendant la nuit de la VEILLE.
  const controles = sorties.map((s) => {
    const attendue = ventesVeille.nuiteesVendues * s.consommationParNuitee;
    return { articleCode: s.code, consommationAttendue: attendue, consommationReelle: s.quantite, ecart: s.quantite - attendue };
  });

  const jourDate = new Date(jour);
  const stats = {
    nuiteesVendues: ventes.nuiteesVendues,
    nombreFactures: copies.length,
    caHebergement: copies.reduce((s, c) => s + c.montantHebergement, 0),
    caRestaurant: copies.reduce((s, c) => s + c.montantRestaurant, 0),
    repartitionCanaux: ventes.repartitionCanaux,
    genereLe: new Date(),
  };
  await prisma.$transaction(async (tx) => {
    await tx.statistiqueJournaliere.upsert({ where: { jour: jourDate }, update: stats, create: { jour: jourDate, ...stats } });
    await tx.controleStockJournalier.deleteMany({ where: { jour: jourDate } });
    await tx.controleStockJournalier.createMany({ data: controles.map((c) => ({ jour: jourDate, ...c })) });
  });

  // BPMN « Écart détecté ? → Signaler l'écart à la direction »
  const ecarts = controles.filter((c) => c.ecart !== 0);
  if (ecarts.length > 0) logger.warn({ jour, ecarts }, "ÉCART DE STOCK : à signaler à la direction");
  return (await listerTableaux(jour, jour))[0];
}

export async function listerTableaux(du: string, au: string) {
  const [stats, controles] = await Promise.all([
    prisma.statistiqueJournaliere.findMany({ where: { jour: { gte: new Date(du), lte: new Date(au) } }, orderBy: { jour: "desc" } }),
    prisma.controleStockJournalier.findMany({ where: { jour: { gte: new Date(du), lte: new Date(au) } }, orderBy: { articleCode: "asc" } }),
  ]);
  return stats.map((s) => {
    const jour = s.jour.toISOString().slice(0, 10);
    const du_jour = controles.filter((c) => c.jour.toISOString().slice(0, 10) === jour);
    return { ...s, jour, controles: du_jour.map(({ jour: _j, ...c }) => c), ecartDetecte: du_jour.some((c) => c.ecart !== 0) };
  });
}

export const listerReversements = (statut?: "A_REVERSER" | "REVERSE") =>
  prisma.reversement.findMany({ where: statut ? { statut } : {}, orderBy: { createdAt: "desc" } });

export async function effectuerReversement(id: string) {
  const { count } = await prisma.reversement.updateMany({ where: { id, statut: "A_REVERSER" }, data: { statut: "REVERSE", reverseLe: new Date() } });
  if (count === 0) {
    if (!(await prisma.reversement.findUnique({ where: { id } }))) throw NotFound("Reversement");
    throw RegleMetier("Ce reversement a déjà été effectué");
  }
  return prisma.reversement.findUniqueOrThrow({ where: { id } });
}

export const listerCopies = (jour?: string) =>
  prisma.copieFacture.findMany({ where: jour ? { clotureeLe: bornes(jour) } : {}, orderBy: { clotureeLe: "desc" }, take: 500 });
