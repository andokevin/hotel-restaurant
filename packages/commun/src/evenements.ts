import { z } from "zod";

// Catalogue des événements (docs/modele-donnees.md), transporté par BullMQ.
// Ce fichier est un CONTRAT : la forme exacte de chaque message, partagée par l'émetteur
// et ses consommateurs. Il ne contient aucune règle métier.
//
// Couche V1 uniquement. Les événements écoutés seulement par des services V2/V3
// (notification, livraison) sont quand même émis : le jour où ces services existeront,
// ils s'abonneront sans qu'on touche au code de l'émetteur.

const date = z.iso.date(); // "2026-10-10"
const horodatage = z.iso.datetime(); // "2026-10-10T08:30:00.000Z"

export const CONTRATS = {
  "reservation.creee": z.object({
    reservationId: z.uuid(),
    reference: z.string(),
    clientId: z.uuid().nullable(),
    clientNom: z.string(),
    clientTelephone: z.string(),
    clientEmail: z.email(),
    langue: z.enum(["FR", "MG", "EN"]),
    categorieCode: z.string(),
    chambreNumero: z.string(),
    dateArrivee: date,
    dateDepart: date,
    nbNuits: z.number().int().positive(),
    montantTotal: z.number().int().nonnegative(),
    expireLe: horodatage,
  }),
  "reservation.confirmee": z.object({
    reservationId: z.uuid(),
    reference: z.string(),
    clientId: z.uuid().nullable(),
    clientNom: z.string(),
    clientTelephone: z.string(),
    clientEmail: z.email(),
    langue: z.enum(["FR", "MG", "EN"]),
  }),
  "paiement.recu": z.object({
    paiementId: z.uuid(),
    factureId: z.uuid(),
    reservationId: z.uuid().nullable(),
    commandeId: z.uuid().nullable(),
    montant: z.number().int().positive(),
  }),
  "sejour.commence": z.object({
    reservationId: z.uuid(),
    chambreId: z.uuid(),
    chambreNumero: z.string(),
    dateArrivee: date,
    dateDepart: date,
  }),
  "sejour.termine": z.object({
    reservationId: z.uuid(),
    chambreId: z.uuid(),
    chambreNumero: z.string(),
    dateArrivee: date,
    dateDepart: date,
    nbNuits: z.number().int().positive(),
    checkOutLe: horodatage,
  }),
  "menage.termine": z.object({
    tacheId: z.uuid(),
    chambreId: z.uuid(),
    chambreNumero: z.string(),
    articles: z.array(z.object({ code: z.string(), quantite: z.number().int().nonnegative() })),
  }),
} as const;

export type TypeEvenement = keyof typeof CONTRATS;
export type ContenuEvenement<T extends TypeEvenement> = z.infer<(typeof CONTRATS)[T]>;

// Ce qui voyage dans BullMQ : l'id (celui de la ligne outbox_evenement, clé d'idempotence),
// le type, l'heure d'émission et le contenu.
export type Enveloppe<T extends TypeEvenement> = {
  id: string;
  type: T;
  emisLe: string;
  payload: ContenuEvenement<T>;
};

// Prédicat de type : si la fonction renvoie true, TypeScript SAIT que `donnees` est une Enveloppe<T>.
// (Un schéma Zod construit à partir d'un type générique ne permet pas à TypeScript de déduire
// le type seul ; le prédicat évite tout cast.) Les contrats n'ont ni valeur par défaut ni
// transformation : valider suffit, il n'y a rien à convertir.
export function estEnveloppe<T extends TypeEvenement>(type: T, donnees: unknown): donnees is Enveloppe<T> {
  const base = z
    .object({ id: z.uuid(), type: z.literal(type), emisLe: horodatage, payload: z.unknown() })
    .safeParse(donnees);
  return base.success && CONTRATS[type].safeParse(base.data.payload).success;
}

export const estTypeEvenement = (t: string): t is TypeEvenement => t in CONTRATS;

export type Consommateur = "hebergement" | "facturation" | "menage" | "stock" | "restaurant" | "comptabilite";

// Qui écoute quoi en V1. BullMQ n'a pas de diffusion : un job n'est lu que par UN worker.
// Le relais de l'outbox dépose donc une copie de l'événement dans la file de CHAQUE abonné.
export const ABONNEMENTS: Record<TypeEvenement, readonly Consommateur[]> = {
  "reservation.creee": ["facturation"],
  "reservation.confirmee": [], // notification (V2)
  "paiement.recu": ["hebergement"], // + restaurant en phase 6
  "sejour.commence": ["menage"],
  "sejour.termine": ["menage", "facturation"],
  "menage.termine": ["hebergement", "stock"],
};

// BullMQ interdit ":" dans les noms de file ; on utilise des points.
export const nomFile = (consommateur: Consommateur, type: TypeEvenement) => `evt.${consommateur}.${type}`;
