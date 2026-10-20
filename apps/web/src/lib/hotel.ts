// Coordonnées affichées sur le site public.
// À REMPLACER par les vraies coordonnées de l'hôtel avant la mise en production.
export const HOTEL = {
  adresse: "Lot IVB, Antananarivo 101 — près de la place de l'Indépendance",
  telephone: "+261 34 12 345 67",
  horaires: "Réception ouverte 24 h/24",
};

// Photo d'une catégorie : déposer le fichier dans apps/web/public/chambres/<code en minuscules>.jpg
// (ex. public/chambres/suite_senior.jpg). Sans fichier, la carte affiche une illustration.
export const photoCategorie = (code: string) => `/chambres/${code.toLowerCase()}.jpg`;
