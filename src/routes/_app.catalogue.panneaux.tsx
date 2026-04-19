import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { FamilleBadge } from "@/components/FamilleBadge";
import { ImportDialog, type ImportRow } from "@/components/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Search, Loader2, Upload, Download, ChevronRight, List, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { FAMILLES, formatEuro, formatNumber } from "@/lib/familles";
import type { Typologie } from "@/lib/typologies";
import { exportXLSX } from "@/lib/import-parsers";
import { CatalogueSubnav } from "./_app.catalogue.typologies";

const searchSchema = z.object({ matiere: z.string().optional() });

export const Route = createFileRoute("/_app/catalogue/panneaux")({
  head: () => ({ meta: [{ title: "Panneaux — Setup Stock" }] }),
  validateSearch: searchSchema,
  component: PanneauxPage,
});

type Matiere = Tables<"matieres">;

type CatRow = {
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

function PanneauxPage() {
  const { ready } = useAdminGuard();
  const search = Route.useSearch();
  const [items, setItems] = useState<CatRow[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [typologies, setTypologies] = useState<Typologie[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debQ = useDebounced(q);
  const [familleFilter, setFamilleFilter] = useState("all");
  const [typoFilter, setTypoFilter] = useState("all");
  const [matiereFilter, setMatiereFilter] = useState(search.matiere ?? "all");
  const [hideInactive, setHideInactive] = useState(true);
  const [hideStockZero, setHideStockZero] = useState(true);
  const [editing, setEditing] = useState<CatRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [expandedMat, setExpandedMat] = useState<Set<string>>(new Set());
  const [expandedFmt, setExpandedFmt] = useState<Set<string>>(new Set());

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
    (sRes.data ?? []).forEach((s) => { if (s.panneau_id) stockMap.set(s.panneau_id, Number(s.quantite_actuelle ?? 0)); });
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

  useEffect(() => { if (ready) void fetchData(); }, [ready]);

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

  const filtered = useMemo(() => items.filter((p) => {
    const ql = debQ.toLowerCase();
    if (ql) {
      const haystack = [p.matiere_code, p.matiere_libelle, p.typo_nom ?? "", p.matiere_variante ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(ql)) return false;
    }
    if (familleFilter !== "all" && p.famille !== familleFilter) return false;
    if (typoFilter !== "all" && p.typo_id !== typoFilter) return false;
    if (matiereFilter !== "all" && p.matiere_id !== matiereFilter) return false;
    if (hideInactive && !p.actif) return false;
    if (hideStockZero && p.auto_masque_si_zero && p.stock_actuel <= 0) return false;
    return true;
  }), [items, debQ, familleFilter, typoFilter, matiereFilter, hideInactive, hideStockZero]);

  const breadcrumb = useMemo(() => {
    if (typoFilter === "all") return null;
    const t = typologies.find((x) => x.id === typoFilter);
    if (!t) return null;
    const familleLabel = FAMILLES.find((f) => f.value === t.famille)?.label ?? t.famille;
    const matCount = matieres.filter((m) => m.typologie_id === t.id).length;
    const panCount = items.filter((p) => p.typo_id === t.id).length;
    return { familleLabel, typoNom: t.nom, matCount, panCount };
  }, [typoFilter, typologies, matieres, items]);

  if (!ready) return <AdminLoader />;

  async function toggleActif(p: CatRow) {
    const newActif = !p.actif;
    const { error } = await supabase.from("panneaux").update({ actif: newActif }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, actif: newActif } : x)));
    toast.success(newActif ? "Référence activée" : "Référence désactivée", {
      action: { label: "Annuler", onClick: () => toggleActif({ ...p, actif: newActif }) },
    });
  }

  async function bulkSetActif(actif: boolean) {
    if (selected.size === 0) return;
    const { error } = await supabase.from("panneaux").update({ actif }).in("id", Array.from(selected));
    if (error) toast.error(error.message);
    else {
      toast.success(`${selected.size} référence(s) ${actif ? "activée(s)" : "désactivée(s)"}`);
      setSelected(new Set());
      void fetchData();
    }
  }

  function exportSelection() {
    const rows = items.filter((p) => selected.has(p.id)).map((p) => ({
      matiere_code: p.matiere_code,
      matiere_libelle: p.matiere_libelle,
      typologie: p.typo_nom,
      variante: p.matiere_variante,
      epaisseur_mm: p.epaisseur_mm,
      famille: p.famille,
      longueur_mm: p.longueur_mm,
      largeur_mm: p.largeur_mm,
      surface_m2: p.surface_m2,
      prix_achat_ht: p.prix_achat_ht,
      stock_actuel: p.stock_actuel,
      actif: p.actif,
    }));
    exportXLSX(rows, `panneaux-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const stockBadge = (p: CatRow) => {
    if (p.stock_actuel <= 0) return "bg-red-50 text-red-700 border-red-200";
    if (p.stock_actuel < p.seuil_alerte) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Panneaux"
        description="Références = matière × dimensions. Le stock se met à jour automatiquement."
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importer
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau panneau
            </Button>
          </>
        }
      />

      <CatalogueSubnav active="panneaux" />

      {breadcrumb && (
        <div className="mb-3 text-xs text-muted-foreground">
          {breadcrumb.familleLabel} → <span className="font-medium text-foreground">{breadcrumb.typoNom}</span>{" "}
          ({breadcrumb.matCount} matière{breadcrumb.matCount > 1 ? "s" : ""}, {breadcrumb.panCount} panneau{breadcrumb.panCount > 1 ? "x" : ""})
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_200px_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher matière, typologie, variante…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={familleFilter} onValueChange={(v) => { setFamilleFilter(v); setTypoFilter("all"); setMatiereFilter("all"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes familles</SelectItem>
            {FAMILLES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typoFilter} onValueChange={(v) => { setTypoFilter(v); setMatiereFilter("all"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes typologies</SelectItem>
            {typologiesFiltered.map((t) => <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={matiereFilter} onValueChange={setMatiereFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes matières</SelectItem>
            {matieresFiltered.map((m) => <SelectItem key={m.id} value={m.id}>{m.libelle}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={hideInactive} onCheckedChange={(v) => setHideInactive(!!v)} />
          Masquer les inactives
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={hideStockZero} onCheckedChange={(v) => setHideStockZero(!!v)} />
          Masquer stock 0 (auto-masque)
        </label>
        <span className="text-muted-foreground ml-auto">
          Affichées : <strong className="text-foreground">{filtered.length}</strong> / {items.length}
          {(hideInactive || hideStockZero) && (
            <button
              onClick={() => { setHideInactive(false); setHideStockZero(false); }}
              className="ml-3 link-arrow"
            >
              Tout afficher →
            </button>
          )}
        </span>
      </div>

      {selected.size > 0 && (
        <Card className="mb-4 px-4 py-3 flex items-center gap-3 text-sm rounded-2xl">
          <span className="font-medium">{selected.size} sélectionnée(s)</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => bulkSetActif(false)}>Désactiver</Button>
            <Button variant="outline" size="sm" onClick={() => bulkSetActif(true)}>Réactiver</Button>
            <Button variant="outline" size="sm" onClick={exportSelection}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exporter
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Désélectionner</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-4">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) filtered.forEach((p) => next.add(p.id));
                      else filtered.forEach((p) => next.delete(p.id));
                      setSelected(next);
                    }}
                  />
                </th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Matière</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Dimensions</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Surface</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Prix HT</th>
                <th className="text-center px-6 py-4 font-medium text-muted-foreground">Stock</th>
                <th className="text-center px-6 py-4 font-medium text-muted-foreground">Actif</th>
                <th className="px-6 py-4 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">Aucune référence</td></tr>}
              {filtered.map((p, idx) => (
                <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/30" : ""} ${!p.actif ? "opacity-60" : ""}`}>
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(p.id); else next.delete(p.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FamilleBadge famille={p.famille} />
                        {p.typo_nom && <span className="font-medium">{p.typo_nom}</span>}
                        {p.matiere_variante && <span className="text-muted-foreground">{p.matiere_variante}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{p.matiere_code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs tabular-nums">
                    {p.longueur_mm} × {p.largeur_mm} mm
                    {p.epaisseur_mm ? <span className="ml-2 text-muted-foreground">· {p.epaisseur_mm}mm ép.</span> : null}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatNumber(p.surface_m2, 3)} m²</td>
                  <td className="px-6 py-4 text-right tabular-nums">{formatEuro(p.prix_achat_ht)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium tabular-nums ${stockBadge(p)}`}>
                      {formatNumber(p.stock_actuel, 2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Switch checked={p.actif} onCheckedChange={() => toggleActif(p)} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(creating || editing) && (
        <PanneauDialog
          panneau={editing}
          matieres={matieres}
          typologies={typologies}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { void fetchData(); setCreating(false); setEditing(null); }}
        />
      )}

      {importing && (
        <ImportDialog<TablesInsert<"panneaux"> & { _matiere_code: string }>
          open
          onClose={() => { setImporting(false); void fetchData(); }}
          title="Importer des panneaux"
          description="CSV/XLSX. La matière doit déjà exister (par code)."
          expectedColumns={["matiere_code", "longueur_mm", "largeur_mm", "epaisseur_mm"]}
          validateRow={async (raw) => {
            const errors: string[] = [];
            const matCode = String(raw.matiere_code ?? "").trim();
            const matiere = matieres.find((m) => m.code.toLowerCase() === matCode.toLowerCase());
            if (!matCode) errors.push("Code matière requis");
            else if (!matiere) errors.push(`Matière inconnue : ${matCode}`);
            const lon = Number(String(raw.longueur_mm ?? "").replace(",", "."));
            if (!Number.isFinite(lon) || lon <= 0) errors.push("Longueur invalide");
            const lar = Number(String(raw.largeur_mm ?? "").replace(",", "."));
            if (!Number.isFinite(lar) || lar <= 0) errors.push("Largeur invalide");
            const ep = Number(String(raw.epaisseur_mm ?? "").replace(",", "."));
            if (!Number.isFinite(ep) || ep <= 0) errors.push("Épaisseur invalide");
            const prixRaw = String(raw.prix_achat_ht ?? "").replace(",", ".");
            const prix = prixRaw ? Number(prixRaw) : null;
            const refF = String(raw.reference_fournisseur ?? "").trim() || null;
            const isDuplicate = matiere ? items.some((p) =>
              p.matiere_id === matiere.id
              && p.longueur_mm === Math.round(lon)
              && p.largeur_mm === Math.round(lar)
              && p.epaisseur_mm === Math.round(ep),
            ) : false;
            return {
              data: errors.length || !matiere ? null : {
                matiere_id: matiere.id,
                longueur_mm: Math.round(lon),
                largeur_mm: Math.round(lar),
                epaisseur_mm: Math.round(ep),
                prix_achat_ht: prix,
                reference_fournisseur: refF,
                _matiere_code: matCode,
              },
              errors,
              isDuplicate,
            };
          }}
          columnsPreview={[
            { key: "matiere_code", label: "Matière" },
            { key: "longueur_mm", label: "Longueur" },
            { key: "largeur_mm", label: "Largeur" },
            { key: "epaisseur_mm", label: "Ép. (mm)" },
            { key: "prix_achat_ht", label: "Prix HT" },
            { key: "reference_fournisseur", label: "Réf. fournisseur" },
          ]}
          importRows={async (rows: ImportRow<TablesInsert<"panneaux"> & { _matiere_code: string }>[]) => {
            let inserted = 0, updated = 0, skipped = 0, errors = 0;
            for (const r of rows) {
              if (!r.data) { skipped++; continue; }
              const { _matiere_code: _ignored, ...payload } = r.data;
              if (r.action === "overwrite") {
                const { error } = await supabase.from("panneaux").update(payload)
                  .eq("matiere_id", payload.matiere_id)
                  .eq("longueur_mm", payload.longueur_mm)
                  .eq("largeur_mm", payload.largeur_mm)
                  .eq("epaisseur_mm", payload.epaisseur_mm);
                if (error) errors++; else updated++;
              } else if (r.action === "create") {
                const { error } = await supabase.from("panneaux").insert(payload);
                if (error) errors++; else inserted++;
              } else skipped++;
            }
            return { inserted, updated, skipped, errors };
          }}
        />
      )}
    </div>
  );
}

function PanneauDialog({
  panneau,
  matieres,
  typologies,
  onClose,
  onSaved,
}: {
  panneau: CatRow | null;
  matieres: Matiere[];
  typologies: Typologie[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialMat = panneau ? matieres.find((m) => m.id === panneau.matiere_id) ?? null : null;
  const [familleFilter, setFamilleFilter] = useState<string>(initialMat?.famille ?? "all");
  const [typoFilter, setTypoFilter] = useState<string>(initialMat?.typologie_id ?? "all");
  const [form, setForm] = useState<TablesInsert<"panneaux">>({
    matiere_id: panneau?.matiere_id ?? "",
    longueur_mm: panneau?.longueur_mm ?? 0,
    largeur_mm: panneau?.largeur_mm ?? 0,
    epaisseur_mm: panneau?.epaisseur_mm ?? 0,
    prix_achat_ht: panneau?.prix_achat_ht ?? null,
    reference_fournisseur: panneau?.reference_fournisseur ?? "",
    actif: panneau?.actif ?? true,
    auto_masque_si_zero: panneau?.auto_masque_si_zero ?? true,
  });
  const [saving, setSaving] = useState(false);

  const typoOptions = useMemo(() => {
    if (familleFilter === "all") return typologies.filter((t) => t.actif);
    return typologies.filter((t) => t.actif && t.famille === familleFilter);
  }, [typologies, familleFilter]);

  const matiereOptions = useMemo(() => {
    return matieres.filter((m) => {
      if (!m.actif) return false;
      if (familleFilter !== "all" && m.famille !== familleFilter) return false;
      if (typoFilter !== "all" && m.typologie_id !== typoFilter) return false;
      return true;
    });
  }, [matieres, familleFilter, typoFilter]);

  async function handleSave() {
    if (!form.matiere_id || !form.longueur_mm || !form.largeur_mm || !form.epaisseur_mm) {
      toast.error("Matière, dimensions et épaisseur sont requis");
      return;
    }
    setSaving(true);
    const payload = { ...form, reference_fournisseur: form.reference_fournisseur || null };
    const res = panneau
      ? await supabase.from("panneaux").update(payload).eq("id", panneau.id)
      : await supabase.from("panneaux").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(panneau ? "Panneau modifié" : "Panneau créé"); onSaved(); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{panneau ? "Modifier" : "Nouveau"} panneau</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Famille</Label>
              <Select value={familleFilter} onValueChange={(v) => { setFamilleFilter(v); setTypoFilter("all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {FAMILLES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Typologie</Label>
              <Select value={typoFilter} onValueChange={setTypoFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {typoOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Matière *</Label>
            <Select value={form.matiere_id} onValueChange={(v) => setForm({ ...form, matiere_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder={matiereOptions.length ? "Sélectionner…" : "Aucune matière disponible"} />
              </SelectTrigger>
              <SelectContent>
                {matiereOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Longueur (mm) *</Label>
              <Input type="number" value={form.longueur_mm || ""} onChange={(e) => setForm({ ...form, longueur_mm: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Largeur (mm) *</Label>
              <Input type="number" value={form.largeur_mm || ""} onChange={(e) => setForm({ ...form, largeur_mm: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Épaisseur (mm) *</Label>
              <Input type="number" value={form.epaisseur_mm || ""} onChange={(e) => setForm({ ...form, epaisseur_mm: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prix d'achat HT</Label>
              <Input type="number" step="0.01" value={form.prix_achat_ht ?? ""} onChange={(e) => setForm({ ...form, prix_achat_ht: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="space-y-2">
              <Label>Réf. fournisseur</Label>
              <Input value={form.reference_fournisseur ?? ""} onChange={(e) => setForm({ ...form, reference_fournisseur: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-3 border border-border rounded-lg">
              <span className="text-sm font-medium">Référence active</span>
              <Switch checked={form.actif ?? true} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
            </label>
            <label className="flex items-center justify-between p-3 border border-border rounded-lg">
              <span className="text-sm font-medium">Masquer si stock 0</span>
              <Switch checked={form.auto_masque_si_zero ?? true} onCheckedChange={(v) => setForm({ ...form, auto_masque_si_zero: v })} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
