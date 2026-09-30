import { z } from "zod";
import { aujourdhuiMadagascar } from "../../temps.js";

export const creerReservationSchema = z
  .object({
    chambreId: z.uuid(),
    clientNom: z.string().min(2).max(100),
    clientTelephone: z.string().regex(/^0(32|33|34|37|38)\d{7}$/, "Numéro malgache invalide"),
    clientEmail: z.email().optional(),
    pieceIdentiteType: z.enum(["CIN", "PASSEPORT"]),
    pieceIdentiteNumero: z.string().min(4).max(30),
    dateArrivee: z.iso.date(),
    dateDepart: z.iso.date(),
    canal: z.enum(["SITE_WEB", "RECEPTION", "FACEBOOK", "ASSISTANT_IA"]).default("RECEPTION"),
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

export type CreerReservationDTO = z.infer<typeof creerReservationSchema>;
export type FiltreReservation = z.infer<typeof filtreReservationSchema>;
