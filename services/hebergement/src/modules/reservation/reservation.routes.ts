import { Router} from 'express';
import * as controller from './reservation.controller.js';

export const routeurReservations = Router();

routeurReservations.get('/', controller.lister);
routeurReservations.get('/:id', controller.details);
routeurReservations.post('/', controller.creer);
routeurReservations.post("/:id/confirmer", controller.confirmer);