import { useEffect, useState } from "react";

// Au-delà de ce délai, une commande encore en cours est signalée « En retard » en cuisine.
export const SEUIL_RETARD_MIN = 15;

export const minutesEcoulees = (depuis: string, maintenant: number): number =>
  Math.max(0, Math.floor((maintenant - Date.parse(depuis)) / 60_000));

export const libelleAttente = (minutes: number): string => {
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};

// L'heure actuelle, rafraîchie régulièrement : les « il y a 12 min » avancent sans recharger la page.
export function useMaintenant(intervalleMs = 30_000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(Date.now()), intervalleMs);
    return () => clearInterval(minuteur);
  }, [intervalleMs]);
  return maintenant;
}
