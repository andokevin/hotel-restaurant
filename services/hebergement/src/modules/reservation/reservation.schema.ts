import { z } from "zod";
import { aujourdhuiMadagascar, telephone } from "@hotel/commun";

// Décision D3 : le client choisit une CATÉGORIE, le serveur choisit la chambre.
export const creerReservationSchema = z
  .object({
    categorieId: z.uuid(),
    clientNom: z.string().trim().min(2).max(100),
    clientTelephone: telephone,
    // Obligatoire : le reçu et la confirmation partent par email
    clientEmail: z.string().trim().toLowerCase().pipe(z.email("Email invalide")),
    pieceIdentiteType: z.enum(["CIN", "PASSEPORT"]),
    pieceIdentiteNumero: z.string().trim().min(4).max(30),
    dateArrivee: z.iso.date(),
    dateDepart: z.iso.date(),
    // Canal V1 déclaré par le personnel ; pour un CLIENT, il est forcé à SITE_WEB.
    // (ASSISTANT_IA existe dans l'enum de la base mais relève de la V3.)
    canal: z.enum(["RECEPTION", "FACEBOOK", "SITE_WEB"]).default("RECEPTION"),
    langue: z.enum(["FR", "MG", "EN"]).default("FR"),
  })
  // Les dates sont des chaînes AAAA-MM-JJ : l'ordre alphabétique est l'ordre chronologique.
  .refine((d) => d.dateDepart > d.dateArrivee, {
    message: "La date de départ doit être après la date d'arrivée",
    path: ["dateDepart"],
  })
  .refine((d) => d.dateArrivee >= aujourdhuiMadagascar(), {
    message: "La date d'arrivée ne peut pas être dans le passé",
    path: ["dateArrivee"],
  });

export const filtreReservationSchema = z.object({
  statut: z.enum(["EN_ATTENTE_PAIEMENT", "CONFIRMEE", "EN_COURS", "TERMINEE", "ANNULEE"]).optional(),
});

// Tâche BPMN « Vérifier la pièce d'identité » : la réceptionniste doit le confirmer explicitement.
export const checkInSchema = z.object({
  pieceIdentiteVerifiee: z.literal(true, "La pièce d'identité doit être vérifiée avant le check-in"),
  // Réattribution : une autre chambre PROPRE de la même catégorie
  chambreId: z.uuid().optional(),
});

export const enCoursSchema = z.object({ chambre: z.string().min(1).max(10) });

// En-tête Idempotency-Key : un uuid généré par le client pour chaque NOUVELLE action.
export const cleIdempotenceSchema = z.uuid("Idempotency-Key doit être un uuid").optional();

export type CreerReservationDTO = z.infer<typeof creerReservationSchema>;
export type FiltreReservation = z.infer<typeof filtreReservationSchema>;
export type CheckInDTO = z.infer<typeof checkInSchema>;
