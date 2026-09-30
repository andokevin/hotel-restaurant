import { z } from "zod";
import { anneeMadagascar, AppError, Conflit, NotFound, RegleMetier, type Enveloppe, type Identite } from "@hotel/commun";
import { prisma } from "../../db.js";
import type { StatutCommande } from "../../generated/prisma/client.js";
import { ecrireEvenement, traiterUneFois } from "../../outbox.js";
import { creerFactureRestaurant, sejourEnCours } from "../../services-externes.js";
import type { CreerCommandeDTO } from "./commande.schema.js";

const fr = (json: unknown) => z.object({ fr: z.string() }).catch({ fr: "?" }).parse(json).fr;

// Préparation : RECUE → EN_PREPARATION → PRETE → REMISE ; ANNULEE tant que rien n'est remis.
const TRANSITIONS: Record<StatutCommande, readonly StatutCommande[]> = {
  RECUE: ["EN_PREPARATION", "ANNULEE"],
  EN_PREPARATION: ["PRETE", "ANNULEE"],
  PRETE: ["REMISE", "ANNULEE"],
  REMISE: [],
  ANNULEE: [],
};

const trouver = async (id: string) => {
  const c = await prisma.commande.findUnique({ where: { id }, include: { lignes: true } });
  if (!c) throw NotFound("Commande");
  return c;
};

export const listerCommandes = (statut?: StatutCommande) =>
  prisma.commande.findMany({ where: statut ? { statut } : {}, include: { lignes: true }, orderBy: { createdAt: "desc" }, take: 200 });

// Tâche BPMN « Prendre la commande ». Le prix de chaque plat est LU EN BASE et copié dans la ligne
// (snapshot) : le navigateur n'envoie que des identifiants et des quantités.
export async function creerCommande(data: CreerCommandeDTO, identite: Identite) {
  const plats = await prisma.plat.findMany({ where: { id: { in: data.lignes.map((l) => l.platId) } } });
  const lignes = data.lignes.map((l) => {
    const plat = plats.find((p) => p.id === l.platId);
    if (!plat) throw NotFound("Plat");
    if (!plat.disponible) throw RegleMetier(`« ${fr(plat.nom)} » n'est plus disponible`);
    return { platId: plat.id, platNom: fr(plat.nom), prixUnitaire: plat.prix, quantite: l.quantite };
  });
  const montantTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);

  return prisma.$transaction(async (tx) => {
    const annee = anneeMadagascar();
    const compteur = await tx.compteurCommande.upsert({
      where: { annee },
      create: { annee, dernierNumero: 1 },
      update: { dernierNumero: { increment: 1 } },
    });
    return tx.commande.create({
      data: {
        reference: `CMD-${annee}-${String(compteur.dernierNumero).padStart(6, "0")}`,
        canal: data.canal,
        tableNumero: data.tableNumero,
        clientNom: data.clientNom,
        montantTotal,
        serviPar: identite.id,
        lignes: { create: lignes },
      },
      include: { lignes: true },
    });
  });
}

export async function changerStatut(id: string, statut: StatutCommande) {
  const c = await trouver(id);
  if (!TRANSITIONS[c.statut].includes(statut)) throw RegleMetier(`Transition interdite : ${c.statut} → ${statut}`);
  if (statut === "ANNULEE" && c.statutPaiement !== "NON_PAYEE") throw RegleMetier("Une commande payée ou imputée ne s'annule pas");
  const { count } = await prisma.commande.updateMany({ where: { id, version: c.version }, data: { statut, version: { increment: 1 } } });
  if (count === 0) throw Conflit("La commande a été modifiée entre-temps, réessayez");
  return trouver(id);
}

// BPMN « Ajouter à la facture de la chambre ? » → OUI : « Imputer la facture à la chambre ».
// Vérification SYNCHRONE du séjour (le serveur attend la réponse), puis événement ASYNCHRONE vers facturation.
// L'argent reste celui du restaurant : facturation l'inscrit avec origine = RESTAURANT.
export async function imputerALaChambre(id: string, chambreNumero: string) {
  const c = await trouver(id);
  if (c.statut === "ANNULEE") throw RegleMetier("Commande annulée");
  if (c.statutPaiement !== "NON_PAYEE") throw new AppError(409, "COMMANDE_DEJA_REGLEE", `Commande déjà ${c.statutPaiement}`);

  const sejour = await sejourEnCours(chambreNumero); // appel réseau AVANT la transaction

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.commande.updateMany({
      where: { id, statutPaiement: "NON_PAYEE" },
      data: { statutPaiement: "IMPUTEE_CHAMBRE", reservationId: sejour.id, chambreNumero: sejour.chambre.numero, clientNom: c.clientNom ?? sejour.clientNom, version: { increment: 1 } },
    });
    if (count === 0) throw new AppError(409, "COMMANDE_DEJA_REGLEE", "Commande déjà réglée entre-temps");
    await ecrireEvenement(tx, "consommation.imputee", {
      commandeId: c.id,
      reference: c.reference,
      reservationId: sejour.id,
      chambreNumero: sejour.chambre.numero,
      lignes: c.lignes.map((l) => ({ libelle: l.platNom, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
      montant: c.montantTotal,
    });
  });
  return trouver(id);
}

// BPMN « Non » : « Établir la facture restaurant » → encaissée ensuite au restaurant (POST /factures/:id/encaissements).
export async function facturer(id: string) {
  const c = await trouver(id);
  if (c.statut === "ANNULEE") throw RegleMetier("Commande annulée");
  if (c.statutPaiement === "IMPUTEE_CHAMBRE") throw new AppError(409, "COMMANDE_DEJA_REGLEE", "Commande déjà imputée à une chambre");
  // Idempotent côté facturation (une facture par commande) : un double clic renvoie la même facture.
  const f = await creerFactureRestaurant({
    commandeId: c.id,
    reference: c.reference,
    clientNom: c.clientNom ?? (c.tableNumero ? `Table ${c.tableNumero}` : "Client restaurant"),
    lignes: c.lignes.map((l) => ({ libelle: l.platNom, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
  });
  return { factureId: f.id, numero: f.numero, montant: f.montantTotal };
}

// Consommateur de paiement.recu : la facture de la commande a été encaissée.
export async function traiterPaiementRecu(evt: Enveloppe<"paiement.recu">): Promise<void> {
  const commandeId = evt.payload.commandeId;
  if (!commandeId) return; // paiement d'un séjour : ne concerne pas le restaurant
  await traiterUneFois(evt.id, async (tx) => {
    await tx.commande.updateMany({ where: { id: commandeId, statutPaiement: "NON_PAYEE" }, data: { statutPaiement: "PAYEE", version: { increment: 1 } } });
  });
}
