import { z } from "zod";

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
  .refine((d) => new Date(d.dateDepart) > new Date(d.dateArrivee), {
    message: "La date de départ doit être après la date d'arrivée",
    path: ["dateDepart"],
  })
  .refine((d) => new Date(d.dateArrivee) >= new Date(new Date().toDateString()), {
    message: "La date d'arrivée ne peut pas être dans le passé",
    path: ["dateArrivee"],
  });

export type CreerReservationDTO = z.infer<typeof creerReservationSchema>;