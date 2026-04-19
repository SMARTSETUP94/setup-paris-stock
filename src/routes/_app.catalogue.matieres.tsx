import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Search,
  Loader2,
  Upload,
  Boxes,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { FAMILLES, UNITES, type Famille, type UniteStock } from "@/lib/familles";
import { useFamilles } from "@/hooks/useFamilles";
import { autoMatiereCode, autoMatiereLibelle, type Typologie } from "@/lib/typologies";
import { CatalogueSubnav } from "./_app.catalogue.typologies";

export const Route = createFileRoute("/_app/catalogue/matieres")({
  head: () => ({ meta: [{ title: "Matières — Setup Stock" }] }),
  component: MatieresPage,
});

type Matiere = Tables<"matieres">;

function MatieresPage() {
  const { ready } = useAdminGuard();
  const navigate = useNavigate();
  const { familles } = useFamilles();
  const [items, setItems] = useState<Matiere[]>([]);
  const [typologies, setTypologies] = useState<Typologie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debSearch = useDebounced(search);
  const [familleFilter, setFamilleFilter] = useState<string>("all");
  const [typoFilter, setTypoFilter] = useState<string>("all");
  const [actifFilter, setActifFilter] = useState<"all" | "yes" | "no">("yes");
  const [editing, setEditing] = useState<Matiere | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  async function fetchData() {
    setLoading(true);
    const [mRes, tRes] = await Promise.all([
      supabase.from("matieres").select("*").order("code"),
      supabase.from("typologies").select("*").order("famille").order("nom"),
    ]);
    if (mRes.error) toast.error(mRes.error.message);
    if (tRes.error) toast.error(tRes.error.message);
    setItems(mRes.data ?? []);
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

  const filtered = useMemo(() => {
    const q = debSearch.toLowerCase().trim();
    return items.filter((m) => {
      if (q) {
        const haystack = [m.code, m.libelle, m.variante ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (familleFilter !== "all" && m.famille !== familleFilter) return false;
      if (typoFilter !== "all" && m.typologie_id !== typoFilter) return false;
      if (actifFilter === "yes" && !m.actif) return false;
      if (actifFilter === "no" && m.actif) return false;
      return true;
    });
  }, [items, debSearch, familleFilter, typoFilter, actifFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Matiere[]>();
    for (const m of filtered) {
      const key = m.typologie_id ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const typoById = new Map(typologies.map((t) => [t.id, t]));
    const sections = Array.from(map.entries()).map(([typoId, mats]) => ({
      typoId,
      typo: typoById.get(typoId) ?? null,
      matieres: mats.sort((a, b) => (a.variante ?? "").localeCompare(b.variante ?? "", "fr")),
    }));
    sections.sort((a, b) => {
      if (!a.typo) return 1;
      if (!b.typo) return -1;
      const f = a.typo.famille.localeCompare(b.typo.famille);
      if (f !== 0) return f;
      return a.typo.nom.localeCompare(b.typo.nom, "fr");
    });
    return sections;
  }, [filtered, typologies]);

  async function toggleActif(m: Matiere) {
    const { error } = await supabase.from("matieres").update({ actif: !m.actif }).eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, actif: !x.actif } : x)));
      toast.success(m.actif ? "Matière désactivée" : "Matière activée");
    }
  }

  function toggleCollapse(typoId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(typoId)) next.delete(typoId);
      else next.add(typoId);
      return next;
    });
  }

  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Matières"
        description="Une matière = typologie + variante. L'épaisseur est définie au niveau du panneau."
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importer
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle matière
            </Button>
          </>
        }
      />

      <CatalogueSubnav active="matieres" />

      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_220px_140px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher code, libellé, variante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={familleFilter}
          onValueChange={(v) => {
            setFamilleFilter(v);
            setTypoFilter("all");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes familles</SelectItem>
            {familles.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typoFilter} onValueChange={setTypoFilter}>
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
        <Select value={actifFilter} onValueChange={(v) => setActifFilter(v as typeof actifFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Actives</SelectItem>
            <SelectItem value="no">Inactives</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <Card className="p-12 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" />
        </Card>
      )}

      {!loading && grouped.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground text-sm">
          Aucune matière. Commencez par créer une typologie puis une matière.
        </Card>
      )}

      {!loading && grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map(({ typoId, typo, matieres }) => {
            const isCollapsed = collapsed.has(typoId);
            return (
              <Card key={typoId} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => toggleCollapse(typoId)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30 hover:bg-muted/50 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    {typo ? (
                      <>
                        <FamilleBadge famille={typo.famille} />
                        <span className="font-semibold">{typo.nom}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-muted">
                          {typo.code}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-muted-foreground">Sans typologie</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {matieres.length} matière{matieres.length > 1 ? "s" : ""}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                            Code
                          </th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                            Variante
                          </th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                            Unité
                          </th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                            Seuil
                          </th>
                          <th className="text-center px-5 py-3 font-medium text-muted-foreground">
                            Actif
                          </th>
                          <th className="px-5 py-3 w-24"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {matieres.map((m, idx) => (
                          <tr
                            key={m.id}
                            className={`border-b border-border last:border-0 hover:bg-muted/40 ${idx % 2 === 1 ? "bg-muted/20" : ""} ${!m.actif ? "opacity-60" : ""}`}
                          >
                            <td className="px-5 py-3">
                              <span className="inline-block px-2 py-0.5 rounded font-mono text-xs bg-muted">
                                {m.code}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {m.variante || (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {UNITES.find((u) => u.value === m.unite_stock)?.label ??
                                m.unite_stock}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums">{m.seuil_alerte}</td>
                            <td className="px-5 py-3 text-center">
                              <Switch checked={m.actif} onCheckedChange={() => toggleActif(m)} />
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate({
                                    to: "/catalogue/panneaux",
                                    search: { matiere: m.id } as never,
                                  })
                                }
                              >
                                <Boxes className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {filtered.length} matière(s) · {grouped.length} typologie(s)
      </p>

      {(creating || editing) && (
        <MatiereDialog
          matiere={editing}
          typologies={typologies}
          existing={items}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            void fetchData();
            setCreating(false);
            setEditing(null);
          }}
          onTypologiesRefresh={fetchData}
        />
      )}

      {importing && (
        <ImportDialog<TablesInsert<"matieres">>
          open
          onClose={() => {
            setImporting(false);
            void fetchData();
          }}
          title="Importer des matières"
          description="Format CSV ou XLSX. La typologie doit déjà exister (par code)."
          expectedColumns={["code", "libelle", "typologie_code"]}
          validateRow={async (raw) => {
            const errors: string[] = [];
            const code = String(raw.code ?? "").trim();
            if (!code) errors.push("Code requis");
            const libelle = String(raw.libelle ?? "").trim();
            if (!libelle) errors.push("Libellé requis");
            const typoCode = String(raw.typologie_code ?? "")
              .trim()
              .toUpperCase();
            const typo = typologies.find((t) => t.code.toUpperCase() === typoCode);
            if (!typoCode) errors.push("typologie_code requis");
            else if (!typo) errors.push(`Typologie inconnue : ${typoCode}`);
            const variante = String(raw.variante ?? "").trim() || null;
            const unite = String(raw.unite_stock ?? "m2").trim() as UniteStock;
            if (!UNITES.find((u) => u.value === unite)) errors.push("Unité invalide");
            const seuil = Number(String(raw.seuil_alerte ?? "0").replace(",", "."));
            const actifStr = String(raw.actif ?? "true")
              .trim()
              .toLowerCase();
            const actif = !["false", "0", "non", "no"].includes(actifStr);
            const isDuplicate = items.some(
              (m) =>
                m.code.toLowerCase() === code.toLowerCase() ||
                (typo &&
                  m.typologie_id === typo.id &&
                  (m.variante ?? "").toLowerCase() === (variante ?? "").toLowerCase()),
            );
            return {
              data:
                errors.length || !typo
                  ? null
                  : {
                      code,
                      libelle,
                      typologie_id: typo.id,
                      variante,
                      unite_stock: unite,
                      seuil_alerte: Number.isFinite(seuil) ? seuil : 0,
                      actif,
                    },
              errors,
              isDuplicate,
            };
          }}
          columnsPreview={[
            { key: "code", label: "Code" },
            { key: "libelle", label: "Libellé" },
            { key: "typologie_code", label: "Typologie" },
            { key: "variante", label: "Variante" },
            { key: "unite_stock", label: "Unité" },
          ]}
          importRows={async (rows: ImportRow<TablesInsert<"matieres">>[]) => {
            let inserted = 0,
              updated = 0,
              skipped = 0,
              errors = 0;
            for (const r of rows) {
              if (!r.data) {
                skipped++;
                continue;
              }
              if (r.action === "overwrite") {
                const { error } = await supabase
                  .from("matieres")
                  .update(r.data)
                  .eq("code", r.data.code);
                if (error) errors++;
                else updated++;
              } else if (r.action === "create") {
                const { error } = await supabase.from("matieres").insert(r.data);
                if (error) errors++;
                else inserted++;
              } else skipped++;
            }
            return { inserted, updated, skipped, errors };
          }}
        />
      )}
    </div>
  );
}

function MatiereDialog({
  matiere,
  typologies,
  existing,
  onClose,
  onSaved,
  onTypologiesRefresh,
}: {
  matiere: Matiere | null;
  typologies: Typologie[];
  existing: Matiere[];
  onClose: () => void;
  onSaved: () => void;
  onTypologiesRefresh: () => Promise<void>;
}) {
  const { familles } = useFamilles();
  const initialTypo = matiere
    ? (typologies.find((t) => t.id === matiere.typologie_id) ?? null)
    : null;
  const [famille, setFamille] = useState<Famille>(
    initialTypo?.famille ?? matiere?.famille ?? "bois",
  );
  const [typoId, setTypoId] = useState<string>(matiere?.typologie_id ?? "");
  const [variante, setVariante] = useState<string>(matiere?.variante ?? "");
  const [unite, setUnite] = useState<UniteStock>(matiere?.unite_stock ?? "m2");
  const [seuil, setSeuil] = useState<number>(matiere?.seuil_alerte ?? 0);
  const [actif, setActif] = useState<boolean>(matiere?.actif ?? true);
  const [code, setCode] = useState<string>(matiere?.code ?? "");
  const [libelle, setLibelle] = useState<string>(matiere?.libelle ?? "");
  const [codeTouched, setCodeTouched] = useState<boolean>(!!matiere);
  const [libelleTouched, setLibelleTouched] = useState<boolean>(!!matiere);
  const [saving, setSaving] = useState(false);
  const [createTypo, setCreateTypo] = useState(false);
  const [newTypo, setNewTypo] = useState({ code: "", nom: "" });

  const typoOptions = useMemo(
    () => typologies.filter((t) => t.famille === famille && t.actif),
    [typologies, famille],
  );

  const currentTypo = useMemo(
    () => typologies.find((t) => t.id === typoId) ?? null,
    [typologies, typoId],
  );

  const variantesSuggerees = useMemo(() => {
    if (!typoId) return [];
    const set = new Set<string>();
    existing.forEach((m) => {
      if (m.typologie_id === typoId && m.variante) set.add(m.variante);
    });
    return Array.from(set).sort();
  }, [existing, typoId]);

  // Auto-libellé / auto-code (sans épaisseur — déplacée au panneau)
  useEffect(() => {
    if (!currentTypo) return;
    if (!codeTouched) setCode(autoMatiereCode(currentTypo.code, variante, null));
    if (!libelleTouched) setLibelle(autoMatiereLibelle(currentTypo.nom, variante, null));
  }, [currentTypo, variante, codeTouched, libelleTouched]);

  async function handleCreateTypo() {
    if (!newTypo.nom.trim()) {
      toast.error("Nom de typologie requis");
      return;
    }
    const tcode = (newTypo.code || newTypo.nom)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 6);
    const { data, error } = await supabase
      .from("typologies")
      .insert({
        code: tcode,
        nom: newTypo.nom.trim(),
        famille,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Typologie créée");
    await onTypologiesRefresh();
    setTypoId(data.id);
    setCreateTypo(false);
    setNewTypo({ code: "", nom: "" });
  }

  async function handleSave() {
    if (!typoId) {
      toast.error("Typologie requise");
      return;
    }
    if (!code.trim() || !libelle.trim()) {
      toast.error("Code et libellé requis");
      return;
    }

    setSaving(true);
    const payload: TablesInsert<"matieres"> = {
      code: code.trim(),
      libelle: libelle.trim(),
      typologie_id: typoId,
      variante: variante.trim() || null,
      unite_stock: unite,
      seuil_alerte: seuil,
      actif,
    };
    const res = matiere
      ? await supabase.from("matieres").update(payload).eq("id", matiere.id)
      : await supabase.from("matieres").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else {
      toast.success(matiere ? "Matière modifiée" : "Matière créée");
      onSaved();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{matiere ? "Modifier" : "Nouvelle"} matière</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 1. Famille */}
          <div className="space-y-2">
            <Label>1. Famille *</Label>
            <Select
              value={famille}
              onValueChange={(v) => {
                setFamille(v as Famille);
                setTypoId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {familles.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Typologie */}
          <div className="space-y-2">
            <Label>2. Typologie *</Label>
            <div className="flex gap-2">
              <Select value={typoId} onValueChange={setTypoId}>
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      typoOptions.length
                        ? "Sélectionner une typologie…"
                        : "Aucune typologie pour cette famille"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {typoOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nom} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateTypo((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {createTypo && (
              <Card className="p-3 space-y-2 bg-muted/30">
                <p className="eyebrow text-xs">
                  Nouvelle typologie · {familles.find((f) => f.value === famille)?.label}
                </p>
                <Input
                  placeholder="Nom (ex: Contreplaqué)"
                  value={newTypo.nom}
                  onChange={(e) => setNewTypo({ ...newTypo, nom: e.target.value })}
                />
                <Input
                  placeholder="Code (auto si vide)"
                  className="font-mono"
                  value={newTypo.code}
                  onChange={(e) => setNewTypo({ ...newTypo, code: e.target.value.toUpperCase() })}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setCreateTypo(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleCreateTypo}>
                    Créer
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* 3. Variante */}
          <div className="space-y-2">
            <Label>3. Variante (optionnelle)</Label>
            <Input
              value={variante}
              onChange={(e) => setVariante(e.target.value)}
              placeholder="ex. Okoumé, Peuplier, brut, mélaminé blanc…"
              list="variantes-list"
            />
            {variantesSuggerees.length > 0 && (
              <datalist id="variantes-list">
                {variantesSuggerees.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            )}
          </div>

          {/* 4. Unité + seuil */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unité de stock</Label>
              <Select value={unite} onValueChange={(v) => setUnite(v as UniteStock)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seuil alerte</Label>
              <Input
                type="number"
                value={seuil}
                onChange={(e) => setSeuil(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            L'épaisseur sera définie au niveau de chaque panneau.
          </p>

          {/* 5. Libellé + code (auto, éditables) */}
          <div className="space-y-2">
            <Label>Libellé (auto)</Label>
            <Input
              value={libelle}
              onChange={(e) => {
                setLibelleTouched(true);
                setLibelle(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label>Code (auto)</Label>
              <Input
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value.toUpperCase());
                }}
                className="font-mono"
              />
            </div>
            <label className="flex items-center gap-2 h-10">
              <Switch checked={actif} onCheckedChange={setActif} />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
