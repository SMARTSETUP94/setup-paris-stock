import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
import { usePanneauxData } from "@/hooks/usePanneauxData";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Upload, Download, List, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { FAMILLES } from "@/lib/familles";
import { exportXLSX } from "@/lib/import-parsers";
import { CatalogueSubnav } from "./_app.catalogue.typologies";
import { PanneauxListView } from "@/components/panneaux/PanneauxListView";
import { PanneauxTreeView } from "@/components/panneaux/PanneauxTreeView";
import { PanneauDialog } from "@/components/panneaux/PanneauDialog";
import { PanneauxImportDialog } from "@/components/panneaux/PanneauxImportDialog";
import type { CatRow } from "@/components/panneaux/types";

const searchSchema = z.object({ matiere: z.string().optional() });

export const Route = createFileRoute("/_app/catalogue/panneaux")({
  head: () => ({ meta: [{ title: "Panneaux — Setup Stock" }] }),
  validateSearch: searchSchema,
  component: PanneauxPage,
});

function PanneauxPage() {
  const { ready } = useAdminGuard();
  const search = Route.useSearch();
  const data = usePanneauxData(ready, search.matiere);
  const {
    items,
    setItems,
    matieres,
    typologies,
    loading,
    q,
    setQ,
    familleFilter,
    setFamilleFilter,
    typoFilter,
    setTypoFilter,
    matiereFilter,
    setMatiereFilter,
    hideInactive,
    setHideInactive,
    hideStockZero,
    setHideStockZero,
    typologiesFiltered,
    matieresFiltered,
    filtered,
    tree,
    fetchData,
  } = data;

  const [editing, setEditing] = useState<CatRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [expandedMat, setExpandedMat] = useState<Set<string>>(new Set());
  const [expandedFmt, setExpandedFmt] = useState<Set<string>>(new Set());

  function toggleMat(key: string) {
    setExpandedMat((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleFmt(key: string) {
    setExpandedFmt((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function expandAllTree() {
    setExpandedMat(new Set(tree.map((m) => m.key)));
    setExpandedFmt(new Set(tree.flatMap((m) => m.formats.map((f) => `${m.key}::${f.key}`))));
  }
  function collapseAllTree() {
    setExpandedMat(new Set());
    setExpandedFmt(new Set());
  }

  async function toggleActif(p: CatRow) {
    const newActif = !p.actif;
    const { error } = await supabase.from("panneaux").update({ actif: newActif }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, actif: newActif } : x)));
    toast.success(newActif ? "Référence activée" : "Référence désactivée", {
      action: { label: "Annuler", onClick: () => toggleActif({ ...p, actif: newActif }) },
    });
  }

  async function bulkSetActif(actif: boolean) {
    if (selected.size === 0) return;
    const { error } = await supabase
      .from("panneaux")
      .update({ actif })
      .in("id", Array.from(selected));
    if (error) toast.error(error.message);
    else {
      toast.success(`${selected.size} référence(s) ${actif ? "activée(s)" : "désactivée(s)"}`);
      setSelected(new Set());
      void fetchData();
    }
  }

  function exportSelection() {
    const rows = items
      .filter((p) => selected.has(p.id))
      .map((p) => ({
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

  if (!ready) return <AdminLoader />;

  const breadcrumb = (() => {
    if (typoFilter === "all") return null;
    const t = typologies.find((x) => x.id === typoFilter);
    if (!t) return null;
    const familleLabel = FAMILLES.find((f) => f.value === t.famille)?.label ?? t.famille;
    const matCount = matieres.filter((m) => m.typologie_id === t.id).length;
    const panCount = items.filter((p) => p.typo_id === t.id).length;
    return { familleLabel, typoNom: t.nom, matCount, panCount };
  })();

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
          {breadcrumb.familleLabel} →{" "}
          <span className="font-medium text-foreground">{breadcrumb.typoNom}</span> (
          {breadcrumb.matCount} matière{breadcrumb.matCount > 1 ? "s" : ""}, {breadcrumb.panCount}{" "}
          panneau{breadcrumb.panCount > 1 ? "x" : ""})
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_200px_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher matière, typologie, variante…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={familleFilter}
          onValueChange={(v) => {
            setFamilleFilter(v);
            setTypoFilter("all");
            setMatiereFilter("all");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes familles</SelectItem>
            {FAMILLES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typoFilter}
          onValueChange={(v) => {
            setTypoFilter(v);
            setMatiereFilter("all");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes typologies</SelectItem>
            {typologiesFiltered.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={matiereFilter} onValueChange={setMatiereFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes matières</SelectItem>
            {matieresFiltered.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            aria-pressed={viewMode === "list"}
          >
            <List className="h-3.5 w-3.5" /> Liste
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs border-l border-border ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            aria-pressed={viewMode === "tree"}
          >
            <FolderTree className="h-3.5 w-3.5" /> Arborescence
          </button>
        </div>
        {viewMode === "tree" && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAllTree} className="h-7 text-xs">
              Tout déplier
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAllTree} className="h-7 text-xs">
              Tout replier
            </Button>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={hideInactive} onCheckedChange={(v) => setHideInactive(!!v)} />
          Masquer les inactives
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={hideStockZero} onCheckedChange={(v) => setHideStockZero(!!v)} />
          Masquer stock 0 (auto-masque)
        </label>
        <span className="text-muted-foreground ml-auto">
          Affichées : <strong className="text-foreground">{filtered.length}</strong> /{" "}
          {items.length}
          {(hideInactive || hideStockZero) && (
            <button
              onClick={() => {
                setHideInactive(false);
                setHideStockZero(false);
              }}
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
            <Button variant="outline" size="sm" onClick={() => bulkSetActif(false)}>
              Désactiver
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkSetActif(true)}>
              Réactiver
            </Button>
            <Button variant="outline" size="sm" onClick={exportSelection}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exporter
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Désélectionner
            </Button>
          </div>
        </Card>
      )}

      {viewMode === "list" ? (
        <PanneauxListView
          loading={loading}
          filtered={filtered}
          selected={selected}
          setSelected={setSelected}
          onToggleActif={toggleActif}
          onEdit={setEditing}
        />
      ) : (
        <PanneauxTreeView
          loading={loading}
          tree={tree}
          expandedMat={expandedMat}
          expandedFmt={expandedFmt}
          toggleMat={toggleMat}
          toggleFmt={toggleFmt}
          selected={selected}
          setSelected={setSelected}
          onToggleActif={toggleActif}
          onEdit={setEditing}
        />
      )}

      {(creating || editing) && (
        <PanneauDialog
          panneau={editing}
          matieres={matieres}
          typologies={typologies}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            void fetchData();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {importing && (
        <PanneauxImportDialog
          matieres={matieres}
          items={items}
          onClose={() => {
            setImporting(false);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
