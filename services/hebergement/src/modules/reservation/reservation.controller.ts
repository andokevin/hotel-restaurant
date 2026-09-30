import type { Request, Response } from "express";
import { z } from "zod";
import { lireId, lireIdentite, NonAutorise, type Identite } from "@hotel/commun";
import {
  checkInSchema,
  cleIdempotenceSchema,
  creerReservationSchema,
  enCoursSchema,
  filtreReservationSchema,
} from "./reservation.schema.js";
import * as service from "./reservation.service.js";

// La gateway a vérifié le jeton et le rôle ; on relit l'identité qu'elle a transmise.
const identiteRequise = (req: Request): Identite => {
  const identite = lireIdentite(req);
  if (!identite) throw NonAutorise();
  return identite;
};

export const creer = async (req: Request, res: Response) => {
  const data = creerReservationSchema.parse(req.body);
  const cle = cleIdempotenceSchema.parse(req.get("idempotency-key"));
  const { reservation, rejouee } = await service.creerReservation(data, identiteRequise(req), cle);
  if (rejouee) res.set("Idempotent-Replayed", "true");
  res.status(201).json(reservation);
};

export const lister = async (req: Request, res: Response) => {
  res.json(await service.listerReservations(filtreReservationSchema.parse(req.query)));
};

export const mesReservations = async (req: Request, res: Response) => {
  res.json(await service.listerMesReservations(identiteRequise(req).id));
};

export const departs = async (_req: Request, res: Response) => {
  res.json(await service.listerDeparts());
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverReservationPour(lireId(req), identiteRequise(req)));
};

export const annuler = async (req: Request, res: Response) => {
  res.json(await service.annulerReservation(lireId(req)));
};

export const checkIn = async (req: Request, res: Response) => {
  res.json(await service.faireCheckIn(lireId(req), checkInSchema.parse(req.body)));
};

export const checkOut = async (req: Request, res: Response) => {
  res.json(await service.faireCheckOut(lireId(req)));
};

// --- routes internes (appels entre services, sans utilisateur) ---

export const detailInterne = async (req: Request, res: Response) => {
  res.json(await service.trouverReservation(lireId(req)));
};

export const confirmerInterne = async (req: Request, res: Response) => {
  res.json(await service.confirmerReservation(lireId(req)));
};

export const statistiquesInterne = async (req: Request, res: Response) => {
  res.json(await service.statistiquesDuJour(z.object({ jour: z.iso.date() }).parse(req.query).jour));
};

export const enCoursInterne = async (req: Request, res: Response) => {
  res.json(await service.reservationEnCours(enCoursSchema.parse(req.query).chambre));
};
