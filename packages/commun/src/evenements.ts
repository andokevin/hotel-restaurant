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
    // Valeurs par défaut : les événements publiés AVANT ce champ (déjà en file) restent valides.
    nbAdultes: z.number().int().min(1).default(1),
    nbEnfants: z.number().int().min(0).default(0),
    montantTotal: z.number().int().nonnegative(),
    expireLe: horodatage,
    // Détail figé pour la facture (une ligne par groupe de nuits au même tarif).
    // Facultatif : les événements publiés avant ce champ n'en ont pas (facture sur une seule ligne).
    nuitees: z
      .array(z.object({ nuit: date, tarifApplique: z.number().int().nonnegative(), saison: z.string().nullable() }))
      .optional(),
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
    type: z.enum(["QUOTIDIEN", "DEPART"]),
    reservationId: z.uuid(),
    chambreId: z.uuid(),
    chambreNumero: z.string(),
    // Articles RÉELLEMENT remplacés, déclarés par la femme de ménage (pas déduits des nuitées :
    // c'est ce qui permet au comptable de détecter un écart)
    articles: z.array(z.object({ code: z.string(), quantite: z.number().int().nonnegative() })),
    termineLe: horodatage,
  }),
  "stock.seuil_atteint": z.object({
    articleId: z.uuid(),
    code: z.string(),
    quantite: z.number().int().nonnegative(),
    seuilAlerte: z.number().int().nonnegative(),
  }),
  "consommation.imputee": z.object({
    commandeId: z.uuid(),
    reference: z.string(),
    reservationId: z.uuid(),
    chambreNumero: z.string(),
    lignes: z.array(z.object({ libelle: z.string(), quantite: z.number().int().positive(), prixUnitaire: z.number().int().positive() })),
    montant: z.number().int().positive(),
  }),
  // Copie de la facture pour le comptable : un snapshot complet, lignes et origine de l'argent compris.
  "facture.cloturee": z.object({
    factureId: z.uuid(),
    numero: z.string(),
    type: z.enum(["SEJOUR", "RESTAURANT"]),
    reservationId: z.uuid().nullable(),
    commandeId: z.uuid().nullable(),
    clientNom: z.string(),
    montantTotal: z.number().int().nonnegative(),
    montantPaye: z.number().int().nonnegative(),
    emiseLe: horodatage,
    clotureeLe: horodatage,
    lignes: z.array(
      z.object({
        libelle: z.string(),
        quantite: z.number().int().positive(),
        prixUnitaire: z.number().int().nonnegative(),
        montant: z.number().int().nonnegative(),
        origine: z.enum(["HEBERGEMENT", "RESTAURANT", "LIVRAISON"]),
      }),
    ),
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

// Valide une enveloppe reçue et renvoie son contenu PARSÉ (null si invalide).
// Parsé, et pas seulement validé : certains contrats ont des valeurs par défaut pour les
// champs ajoutés après coup (ex. nbAdultes de reservation.creee). Un événement publié AVANT
// l'ajout du champ, encore en file, reçoit ainsi la valeur par défaut au lieu d'undefined.
export function lireEnveloppe<T extends TypeEvenement>(type: T, donnees: unknown): Enveloppe<T> | null {
  const base = z
    .object({ id: z.uuid(), type: z.literal(type), emisLe: horodatage, payload: z.unknown() })
    .safeParse(donnees);
  if (!base.success) return null;
  const contenu = CONTRATS[type].safeParse(base.data.payload);
  if (!contenu.success) return null;
  // Un schéma choisi par un type générique (CONTRATS[T]) : TypeScript ne sait pas relier
  // son résultat à ContenuEvenement<T> tout seul. Le cast est sûr : c'est le même schéma.
  return { id: base.data.id, type, emisLe: base.data.emisLe, payload: contenu.data as ContenuEvenement<T> };
}

export const estTypeEvenement = (t: string): t is TypeEvenement => t in CONTRATS;

// Côté producteur : TypeScript disparaît à l'exécution, donc on revalide avec le contrat AVANT
// d'écrire dans l'outbox. Appelée dans la transaction métier : l'erreur l'annule entièrement.
// Erreur ordinaire (500), pas ZodError (400) : un événement invalide est un bug du service,
// pas une faute de l'utilisateur.
export function verifierContenu<T extends TypeEvenement>(type: T, payload: ContenuEvenement<T>): void {
  const r = CONTRATS[type].safeParse(payload);
  if (!r.success) throw new Error(`Événement ${type} invalide : ${z.prettifyError(r.error)}`);
}

export type Consommateur = "hebergement" | "facturation" | "menage" | "stock" | "restaurant" | "comptabilite";

// Qui écoute quoi en V1. BullMQ n'a pas de diffusion : un job n'est lu que par UN worker.
// Le relais de l'outbox dépose donc une copie de l'événement dans la file de CHAQUE abonné.
export const ABONNEMENTS: Record<TypeEvenement, readonly Consommateur[]> = {
  "reservation.creee": ["facturation"],
  "reservation.confirmee": [], // notification (V2)
  "paiement.recu": ["hebergement", "restaurant"],
  "sejour.commence": ["menage"],
  "sejour.termine": ["menage", "facturation"],
  "menage.termine": ["hebergement", "stock"],
  "consommation.imputee": ["facturation"],
  "facture.cloturee": ["comptabilite"],
  "stock.seuil_atteint": [], // notification (V2)
};

// BullMQ interdit ":" dans les noms de file ; on utilise des points.
export const nomFile = (consommateur: Consommateur, type: TypeEvenement) => `evt.${consommateur}.${type}`;
