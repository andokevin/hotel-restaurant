import { aujourdhuiMadagascar, Conflit, Interdit, NotFound, RegleMetier, type Enveloppe, type Identite } from "@hotel/commun";
import { lireNomEmploye } from "../../auth.js";
import { prisma } from "../../db.js";
import { ecrireEvenement, traiterUneFois } from "../../outbox.js";
import type { TerminerDTO } from "./tache.schema.js";

const jourSuivant = (jour: string) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// sejour.commence → une tâche QUOTIDIEN par jour STRICTEMENT entre l'arrivée et le départ.
// Avec la tâche DEPART, on obtient une tâche par nuit : chacune remplace les articles d'une nuitée.
export async function traiterSejourCommence(evt: Enveloppe<"sejour.commence">): Promise<void> {
  const p = evt.payload;
  const jours: string[] = [];
  for (let j = jourSuivant(p.dateArrivee); j < p.dateDepart; j = jourSuivant(j)) jours.push(j);

  await traiterUneFois(evt.id, async (tx) => {
    await tx.tacheMenage.createMany({
      data: jours.map((j) => ({
        reservationId: p.reservationId,
        chambreId: p.chambreId,
        chambreNumero: p.chambreNumero,
        type: "QUOTIDIEN" as const,
        datePrevue: new Date(j),
      })),
      skipDuplicates: true, // UNIQUE (reservation_id, type, date_prevue)
    });
  });
}

// sejour.termine → tâche DEPART le jour du départ réel ; les ménages quotidiens encore à faire
// après un départ anticipé n'ont plus lieu d'être.
export async function traiterSejourTermine(evt: Enveloppe<"sejour.termine">): Promise<void> {
  const p = evt.payload;
  const jour = aujourdhuiMadagascar(new Date(p.checkOutLe));
  await traiterUneFois(evt.id, async (tx) => {
    await tx.tacheMenage.createMany({
      data: [{ reservationId: p.reservationId, chambreId: p.chambreId, chambreNumero: p.chambreNumero, type: "DEPART", datePrevue: new Date(jour) }],
      skipDuplicates: true,
    });
    await tx.tacheMenage.deleteMany({
      where: { reservationId: p.reservationId, type: "QUOTIDIEN", statut: "A_FAIRE", datePrevue: { gte: new Date(jour) } },
    });
  });
}

export const listerTaches = (filtre: { date?: string | undefined; statut?: "A_FAIRE" | "EN_COURS" | "TERMINEE" | undefined }) =>
  prisma.tacheMenage.findMany({
    where: { datePrevue: new Date(filtre.date ?? aujourdhuiMadagascar()), ...(filtre.statut ? { statut: filtre.statut } : {}) },
    orderBy: [{ type: "desc" }, { chambreNumero: "asc" }], // les DEPART d'abord : une chambre à préparer
  });

const trouver = async (id: string) => {
  const t = await prisma.tacheMenage.findUnique({ where: { id } });
  if (!t) throw NotFound("Tâche");
  return t;
};

// La femme de ménage prend la tâche : elle lui est attribuée. Deux employées qui cliquent en même
// temps : la condition statut = A_FAIRE dans l'écriture n'en laisse passer qu'une.
export async function demarrerTache(id: string, identite: Identite) {
  const nom = await lireNomEmploye(identite.id); // appel réseau AVANT l'écriture, hors transaction
  const { count } = await prisma.tacheMenage.updateMany({
    where: { id, statut: "A_FAIRE" },
    data: { statut: "EN_COURS", assigneeId: identite.id, assigneeNom: nom, commenceLe: new Date(), version: { increment: 1 } },
  });
  if (count === 0) {
    const t = await trouver(id);
    if (t.statut === "EN_COURS") throw Conflit(`Tâche déjà prise par ${t.assigneeNom ?? "une collègue"}`);
    throw RegleMetier(`Impossible de démarrer une tâche ${t.statut}`);
  }
  return trouver(id);
}

// Terminer = « Remplacer les articles » + « Notifier la réceptionniste » (BPMN) :
// menage.termine remet la chambre PROPRE (hebergement) et sort les articles (stock).
export async function terminerTache(id: string, identite: Identite, data: TerminerDTO) {
  await prisma.$transaction(async (tx) => {
    const termineLe = new Date();
    const { count } = await tx.tacheMenage.updateMany({
      where: { id, statut: "EN_COURS", assigneeId: identite.id },
      data: { statut: "TERMINEE", termineLe, remarques: data.remarques ?? null, version: { increment: 1 } },
    });
    if (count === 0) {
      const t = await tx.tacheMenage.findUnique({ where: { id } });
      if (!t) throw NotFound("Tâche");
      if (t.statut === "EN_COURS") throw Interdit("Seule l'employée qui a démarré la tâche peut la terminer");
      throw RegleMetier(`Impossible de terminer une tâche ${t.statut}`);
    }
    const t = await tx.tacheMenage.findUniqueOrThrow({ where: { id } });
    await ecrireEvenement(tx, "menage.termine", {
      tacheId: t.id,
      type: t.type,
      reservationId: t.reservationId,
      chambreId: t.chambreId,
      chambreNumero: t.chambreNumero,
      articles: data.articles,
      termineLe: termineLe.toISOString(),
    });
  });
  return trouver(id);
}
