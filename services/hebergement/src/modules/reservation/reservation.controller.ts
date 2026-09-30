import { Request, Response } from "express";
import { creerReservationSchema} from "./reservation.schema.js";
import * as service from "./reservation.service.js";

 export const lister = async (req: Request, res: Response) => {
  const reservations = await service.listerReservations(req.query.statut as string | undefined);
  res.json(reservations);
}

export const details = async (req: Request, res: Response) => {
    const reservationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reservation = await service.trouverReservation(reservationId);
    res.json(reservation);
}

export const creer = async (req: Request, res: Response) => {
    const data = creerReservationSchema.parse(req.body);
    const reservation = await service.creerReservation(data);
    res.status(201).json(reservation);
}

export const confirmer = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await service.confirmerReservation(id));
};