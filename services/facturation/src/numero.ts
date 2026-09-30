import { anneeMadagascar } from "@hotel/commun";
import type { Prisma } from "./generated/prisma/client.js";

// Numérotation séquentielle SANS TROU : FAC-2026-000001, 000002…
// Appelée dans la transaction qui crée la facture : si la facture n'est pas créée,
// l'incrément est annulé avec elle (une facture n'est jamais « sautée »).
// upsert + increment = un seul INSERT … ON CONFLICT DO UPDATE, atomique (vérifié en phase 1).
export async function prochainNumero(tx: Prisma.TransactionClient): Promise<string> {
  const annee = anneeMadagascar();
  const compteur = await tx.compteurFacture.upsert({
    where: { annee },
    create: { annee, dernierNumero: 1 },
    update: { dernierNumero: { increment: 1 } },
  });
  return `FAC-${annee}-${String(compteur.dernierNumero).padStart(6, "0")}`;
}
