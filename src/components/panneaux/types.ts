import type { Tables } from "@/integrations/supabase/types";

export type Matiere = Tables<"matieres">;

export type CatRow = {
  id: string;
  matiere_id: string;
  longueur_mm: number;
  largeur_mm: number;
  epaisseur_mm: number;
  surface_m2: number | null;
  prix_achat_ht: number | null;
  reference_fournisseur: string | null;
  actif: boolean;
  auto_masque_si_zero: boolean;
  matiere_code: string;
  matiere_libelle: string;
  matiere_variante: string | null;
  typo_id: string | null;
  typo_nom: string | null;
  famille: string;
  seuil_alerte: number;
  stock_actuel: number;
};

export type TreeFormat = {
  key: string;
  longueur: number;
  largeur: number;
  surface: number | null;
  panneaux: CatRow[];
};

export type TreeMatiere = {
  key: string;
  matiere_id: string;
  matiere_code: string;
  matiere_libelle: string;
  matiere_variante: string | null;
  typo_nom: string | null;
  famille: string;
  formats: TreeFormat[];
  totalPanneaux: number;
  totalStock: number;
};

export const stockBadgeClass = (p: { stock_actuel: number; seuil_alerte: number }) => {
  if (p.stock_actuel <= 0) return "bg-red-50 text-red-700 border-red-200";
  if (p.stock_actuel < p.seuil_alerte) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};
