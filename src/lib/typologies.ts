import type { Tables } from "@/integrations/supabase/types";
import type { Famille } from "@/lib/familles";

export type Typologie = Tables<"typologies">;

export function slugVariante(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
}

export function autoMatiereCode(
  typoCode: string,
  variante: string | null,
  epaisseur: number | string | null,
): string {
  const ep = epaisseur ? String(epaisseur).replace(",", ".") : "";
  const v = slugVariante(variante);
  const parts = [typoCode.toUpperCase(), v, ep].filter(Boolean);
  return parts.join("-");
}

export function autoMatiereLibelle(
  typoNom: string,
  variante: string | null,
  epaisseur: number | string | null,
): string {
  const v = (variante ?? "").trim();
  const ep = epaisseur ? `${String(epaisseur).replace(",", ".")}mm` : "";
  return [typoNom, v, ep].filter(Boolean).join(" ");
}

export function typologiesByFamille(
  list: Typologie[],
  famille: Famille | string | null | undefined,
): Typologie[] {
  if (!famille || famille === "all") return list.slice().sort(sortByNom);
  return list.filter((t) => t.famille === famille).sort(sortByNom);
}

function sortByNom(a: Typologie, b: Typologie) {
  return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
}
