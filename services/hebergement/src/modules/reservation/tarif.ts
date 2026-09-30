export const listerNuits = (dateArrivee: string, dateDepart: string): Date[] => {
  const nuits: Date[] = [];
  const courante = new Date(dateArrivee + "T00:00:00Z");
  const fin = new Date(dateDepart + "T00:00:00Z");

  while (courante < fin) {
    nuits.push(new Date(courante));
    courante.setUTCDate(courante.getUTCDate() + 1);
  }
  return nuits;
};