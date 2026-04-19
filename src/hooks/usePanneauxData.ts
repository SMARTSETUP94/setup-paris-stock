import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDebounced } from "@/hooks/useAdminGuard";
import type { Typologie } from "@/lib/typologies";
import type { CatRow, Matiere, TreeMatiere, TreeFormat } from "@/components/panneaux/types";

export function usePanneauxData(ready: boolean, initialMatiere?: string) {
  const [items, setItems] = useState<CatRow[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [typologies, setTypologies] = useState<Typologie[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const debQ = useDebounced(q);
  const [familleFilter, setFamilleFilter] = useState("all");
  const [typoFilter, setTypoFilter] = useState("all");
  const [matiereFilter, setMatiereFilter] = useState(initialMatiere ?? "all");
  const [hideInactive, setHideInactive] = useState(true);
  const [hideStockZero, setHideStockZero] = useState(true);

  async function fetchData() {
    setLoading(true);
    const [pRes, mRes, tRes, sRes] = await Promise.all([
      supabase.from("panneaux").select("*").order("created_at", { ascending: false }),
      supabase.from("matieres").select("*").order("code"),
      supabase.from("typologies").select("*"),
      supabase.from("stock_actuel").select("*"),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    if (mRes.error) toast.error(mRes.error.message);

    const stockMap = new Map<string, number>();
    (sRes.data ?? []).forEach((s) => {
      if (s.panneau_id) stockMap.set(s.panneau_id, Number(s.quantite_actuelle ?? 0));
    });
    const matMap = new Map((mRes.data ?? []).map((m) => [m.id, m]));
    const typoMap = new Map((tRes.data ?? []).map((t) => [t.id, t]));

    const rows: CatRow[] = (pRes.data ?? []).map((p) => {
      const m = matMap.get(p.matiere_id);
      const typo = m?.typologie_id ? typoMap.get(m.typologie_id) : null;
      return {
        id: p.id,
        matiere_id: p.matiere_id,
        longueur_mm: p.longueur_mm,
        largeur_mm: p.largeur_mm,
        epaisseur_mm: p.epaisseur_mm,
        surface_m2: p.surface_m2,
        prix_achat_ht: p.prix_achat_ht,
        reference_fournisseur: p.reference_fournisseur,
        actif: p.actif,
        auto_masque_si_zero: p.auto_masque_si_zero,
        matiere_code: m?.code ?? "—",
        matiere_libelle: m?.libelle ?? "—",
        matiere_variante: m?.variante ?? null,
        typo_id: m?.typologie_id ?? null,
        typo_nom: typo?.nom ?? null,
        famille: m?.famille ?? "autre",
        seuil_alerte: m?.seuil_alerte ?? 0,
        stock_actuel: stockMap.get(p.id) ?? 0,
      };
    });
    setItems(rows);
    setMatieres(mRes.data ?? []);
    setTypologies(tRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) void fetchData();
  }, [ready]);

  const typologiesFiltered = useMemo(() => {
    if (familleFilter === "all") return typologies;
    return typologies.filter((t) => t.famille === familleFilter);
  }, [typologies, familleFilter]);

  const matieresFiltered = useMemo(() => {
    return matieres.filter((m) => {
      if (familleFilter !== "all" && m.famille !== familleFilter) return false;
      if (typoFilter !== "all" && m.typologie_id !== typoFilter) return false;
      return true;
    });
  }, [matieres, familleFilter, typoFilter]);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        const ql = debQ.toLowerCase();
        if (ql) {
          const haystack = [p.matiere_code, p.matiere_libelle, p.typo_nom ?? "", p.matiere_variante ?? ""]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(ql)) return false;
        }
        if (familleFilter !== "all" && p.famille !== familleFilter) return false;
        if (typoFilter !== "all" && p.typo_id !== typoFilter) return false;
        if (matiereFilter !== "all" && p.matiere_id !== matiereFilter) return false;
        if (hideInactive && !p.actif) return false;
        if (hideStockZero && p.auto_masque_si_zero && p.stock_actuel <= 0) return false;
        return true;
      }),
    [items, debQ, familleFilter, typoFilter, matiereFilter, hideInactive, hideStockZero],
  );

  const tree = useMemo<TreeMatiere[]>(() => {
    const byMat = new Map<string, TreeMatiere>();
    for (const p of filtered) {
      let m = byMat.get(p.matiere_id);
      if (!m) {
        m = {
          key: p.matiere_id,
          matiere_id: p.matiere_id,
          matiere_code: p.matiere_code,
          matiere_libelle: p.matiere_libelle,
          matiere_variante: p.matiere_variante,
          typo_nom: p.typo_nom,
          famille: p.famille,
          formats: [],
          totalPanneaux: 0,
          totalStock: 0,
        };
        byMat.set(p.matiere_id, m);
      }
      const fmtKey = `${p.longueur_mm}x${p.largeur_mm}`;
      let fmt: TreeFormat | undefined = m.formats.find((f) => f.key === fmtKey);
      if (!fmt) {
        fmt = { key: fmtKey, longueur: p.longueur_mm, largeur: p.largeur_mm, surface: p.surface_m2, panneaux: [] };
        m.formats.push(fmt);
      }
      fmt.panneaux.push(p);
      m.totalPanneaux += 1;
      m.totalStock += p.stock_actuel;
    }
    const arr = Array.from(byMat.values()).sort((a, b) =>
      (a.typo_nom ?? a.matiere_libelle).localeCompare(b.typo_nom ?? b.matiere_libelle, "fr"),
    );
    for (const m of arr) {
      m.formats.sort((a, b) => b.longueur * b.largeur - a.longueur * a.largeur);
      for (const f of m.formats) f.panneaux.sort((a, b) => a.epaisseur_mm - b.epaisseur_mm);
    }
    return arr;
  }, [filtered]);

  return {
    items, setItems,
    matieres, typologies, loading,
    q, setQ,
    familleFilter, setFamilleFilter,
    typoFilter, setTypoFilter,
    matiereFilter, setMatiereFilter,
    hideInactive, setHideInactive,
    hideStockZero, setHideStockZero,
    typologiesFiltered, matieresFiltered,
    filtered, tree,
    fetchData,
  };
}
