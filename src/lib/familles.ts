import type { Database } from "@/integrations/supabase/types";

export type Famille = Database["public"]["Enums"]["famille_matiere"];
export type UniteStock = Database["public"]["Enums"]["unite_stock"];

export const FAMILLES: { value: Famille; label: string; color: string }[] = [
  { value: "bois", label: "Bois", color: "#92400E" },
  { value: "pvc", label: "PVC", color: "#1E40AF" },
  { value: "carton", label: "Carton", color: "#B45309" },
  { value: "dibond_tole", label: "Dibond / Tôle", color: "#475569" },
  { value: "pmma", label: "PMMA / Plexi", color: "#0E7490" },
  { value: "mousse", label: "Mousse", color: "#BE185D" },
  { value: "autre", label: "Autre", color: "#6B7280" },
];

export const UNITES: { value: UniteStock; label: string }[] = [
  { value: "panneau", label: "Panneau" },
  { value: "m2", label: "m²" },
  { value: "ml", label: "ml" },
  { value: "piece", label: "Pièce" },
  { value: "kg", label: "kg" },
  { value: "m3", label: "m³" },
  { value: "boite", label: "Boîte" },
  { value: "cartouche", label: "Cartouche" },
  { value: "autre", label: "Autre" },
];

export function familleMeta(value: Famille | string | null | undefined) {
  return FAMILLES.find((f) => f.value === value) ?? FAMILLES[FAMILLES.length - 1];
}

export function uniteLabel(value: UniteStock | string | null | undefined) {
  return UNITES.find((u) => u.value === value)?.label ?? String(value ?? "");
}

export function slugCode(libelle: string, epaisseur: number | string | null | undefined) {
  const base = (libelle ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const ep = epaisseur ? String(epaisseur).replace(",", ".") : "";
  return ep ? `${base}-${ep}` : base;
}

export function formatEuro(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
}

export function formatNumber(v: number | null | undefined, fractionDigits = 2) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(v);
}
