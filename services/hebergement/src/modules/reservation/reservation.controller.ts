import type { Request, Response } from "express";
import { lireId } from "@hotel/commun";
import { creerReservationSchema, filtreReservationSchema } from "./reservation.schema.js";
import * as service from "./reservation.service.js";

export const lister = async (req: Request, res: Response) => {
  const filtre = filtreReservationSchema.parse(req.query);
  res.json(await service.listerReservations(filtre));
};

export const detail = async (req: Request, res: Response) => {
  res.json(await service.trouverReservation(lireId(req)));
};

export const creer = async (req: Request, res: Response) => {
  const data = creerReservationSchema.parse(req.body);
  res.status(201).json(await service.creerReservation(data));
};

export const confirmer = async (req: Request, res: Response) => {
  res.json(await service.confirmerReservation(lireId(req)));
};
