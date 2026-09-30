// Lectures partagées par plusieurs écrans (même clé de cache = une seule requête réseau).
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Article, Categorie, Chambre, EtatMenage, Menu } from "./types";

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api.get<Categorie[]>("/categories") });

export const useMenusPublies = () =>
  useQuery({ queryKey: ["menus", "publies"], queryFn: () => api.get<Menu[]>("/menus/publies") });

export const useMenus = () => useQuery({ queryKey: ["menus", "tous"], queryFn: () => api.get<Menu[]>("/menus") });

export const useArticles = () => useQuery({ queryKey: ["articles"], queryFn: () => api.get<Article[]>("/articles") });

export const useChambres = (etatMenage?: EtatMenage) =>
  useQuery({
    queryKey: ["chambres", etatMenage ?? "toutes"],
    queryFn: () => api.get<Chambre[]>("/chambres" + (etatMenage ? `?etatMenage=${etatMenage}` : "")),
  });
