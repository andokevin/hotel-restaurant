import type { Prisma } from "./generated/prisma/client.js";

export async function prochainNumero(tx: Prisma.TransactionClient): Promise<string> {
  const annee = new Date().getFullYear();
  const compteur = await tx.compteurFacture.upsert({
    where: { annee },
    create: { annee, dernierNumero: 1 },
    update: { dernierNumero: { increment: 1 } },
  });
  return `FAC-${annee}-${String(compteur.dernierNumero).padStart(6, "0")}`;
}