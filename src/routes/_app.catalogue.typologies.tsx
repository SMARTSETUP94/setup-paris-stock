import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Search, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FAMILLES, type Famille } from "@/lib/familles";
import { useFamilles } from "@/hooks/useFamilles";
import type { Typologie } from "@/lib/typologies";

export const Route = createFileRoute("/_app/catalogue/typologies")({
  head: () => ({ meta: [{ title: "Typologies — Setup Stock" }] }),
  component: TypologiesPage,
});

type Counts = { matieres: number; panneaux: number };

function TypologiesPage() {
  const { ready } = useAdminGuard();
  const { familles } = useFamilles();
  const [items, setItems] = useState<Typologie[]>([]);
  const [counts, setCounts] = useState<Map<string, Counts>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debSearch = useDebounced(search);
  const [familleFilter, setFamilleFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Typologie | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function fetchData() {
    setLoading(true);
    const [tRes, mRes, pRes] = await Promise.all([
      supabase.from("typologies").select("*").order("famille").order("nom"),
      supabase.from("matieres").select("id,typologie_id"),
      supabase.from("panneaux").select("matiere_id"),
    ]);
    if (tRes.error) toast.error(tRes.error.message);

    const matsByTypo = new Map<string, Set<string>>();
    (mRes.data ?? []).forEach((m) => {
      if (!m.typologie_id) return;
      if (!matsByTypo.has(m.typologie_id)) matsByTypo.set(m.typologie_id, new Set());
      matsByTypo.get(m.typologie_id)!.add(m.id);
    });
    const matIdToTypo = new Map<string, string>();
    (mRes.data ?? []).forEach((m) => {
      if (m.typologie_id) matIdToTypo.set(m.id, m.typologie_id);
    });
    const pansByTypo = new Map<string, number>();
    (pRes.data ?? []).forEach((p) => {
      const typoId = matIdToTypo.get(p.matiere_id);
      if (!typoId) return;
      pansByTypo.set(typoId, (pansByTypo.get(typoId) ?? 0) + 1);
    });

    const c = new Map<string, Counts>();
    (tRes.data ?? []).forEach((t) => {
      c.set(t.id, {
        matieres: matsByTypo.get(t.id)?.size ?? 0,
        panneaux: pansByTypo.get(t.id) ?? 0,
      });
    });
    setCounts(c);
    setItems(tRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) void fetchData();
  }, [ready]);

  const filtered = useMemo(() => {
    const q = debSearch.toLowerCase().trim();
    return items.filter((t) => {
      if (familleFilter !== "all" && t.famille !== familleFilter) return false;
      if (q && !t.code.toLowerCase().includes(q) && !t.nom.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, debSearch, familleFilter]);

  async function toggleActif(t: Typologie) {
    const c = counts.get(t.id);
    if (t.actif && c && c.matieres > 0) {
      toast.error(`Impossible de désactiver : ${c.matieres} matière(s) rattachée(s)`);
      return;
    }
    const { error } = await supabase.from("typologies").update({ actif: !t.actif }).eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, actif: !x.actif } : x)));
      toast.success(t.actif ? "Typologie désactivée" : "Typologie activée");
    }
  }

  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Typologies"
        description="Regroupez vos matières par typologie (ex: Contreplaqué, MDF, Mélaminé) au sein d'une famille."
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importer
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle typologie
            </Button>
          </>
        }
      />

      <CatalogueSubnav active="typologies" />

      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher code ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={familleFilter} onValueChange={setFamilleFilter}>
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
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Code</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Famille</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Matières</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Panneaux</th>
                <th className="text-center px-6 py-4 font-medium text-muted-foreground">Actif</th>
                <th className="px-6 py-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    Aucune typologie
                  </td>
                </tr>
              )}
              {filtered.map((t, idx) => {
                const c = counts.get(t.id) ?? { matieres: 0, panneaux: 0 };
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/30" : ""} ${!t.actif ? "opacity-60" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-0.5 rounded font-mono text-xs bg-muted">
                        {t.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{t.nom}</td>
                    <td className="px-6 py-4">
                      <FamilleBadge famille={t.famille} />
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">{c.matieres}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{c.panneaux}</td>
                    <td className="px-6 py-4 text-center">
                      <Switch checked={t.actif} onCheckedChange={() => toggleActif(t)} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {(creating || editing) && (
        <TypologieDialog
          typologie={editing}
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
        />
      )}

      {importing && (
        <ImportDialog<TablesInsert<"typologies">>
          open
          onClose={() => {
            setImporting(false);
            void fetchData();
          }}
          title="Importer des typologies"
          description="Format CSV ou XLSX. Colonnes attendues : code, nom, famille (et description optionnelle)."
          expectedColumns={["code", "nom", "famille"]}
          validateRow={async (raw) => {
            const errors: string[] = [];
            const code = String(raw.code ?? "")
              .trim()
              .toUpperCase();
            if (!code) errors.push("Code requis");
            const nom = String(raw.nom ?? "").trim();
            if (!nom) errors.push("Nom requis");
            const famille = String(raw.famille ?? "")
              .trim()
              .toLowerCase() as Famille;
            if (!FAMILLES.find((f) => f.value === famille))
              errors.push(`Famille invalide : ${raw.famille}`);
            const description = String(raw.description ?? "").trim() || null;
            const isDuplicate = items.some(
              (t) =>
                t.code.toLowerCase() === code.toLowerCase() ||
                (t.famille === famille && t.nom.toLowerCase() === nom.toLowerCase()),
            );
            return {
              data: errors.length ? null : { code, nom, famille, description, actif: true },
              errors,
              isDuplicate,
            };
          }}
          columnsPreview={[
            { key: "code", label: "Code" },
            { key: "nom", label: "Nom" },
            {
              key: "famille",
              label: "Famille",
              render: (d) => <FamilleBadge famille={d.famille} />,
            },
          ]}
          importRows={async (rows: ImportRow<TablesInsert<"typologies">>[]) => {
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
                  .from("typologies")
                  .update(r.data)
                  .eq("code", r.data.code);
                if (error) errors++;
                else updated++;
              } else if (r.action === "create") {
                const { error } = await supabase.from("typologies").insert(r.data);
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

function TypologieDialog({
  typologie,
  existing,
  onClose,
  onSaved,
}: {
  typologie: Typologie | null;
  existing: Typologie[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { familles } = useFamilles();
  const [form, setForm] = useState<TablesInsert<"typologies">>({
    code: typologie?.code ?? "",
    nom: typologie?.nom ?? "",
    famille: typologie?.famille ?? "bois",
    description: typologie?.description ?? null,
    actif: typologie?.actif ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [codeTouched, setCodeTouched] = useState(!!typologie);

  function autoCode(nom: string): string {
    return nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 6);
  }

  function handleNomChange(v: string) {
    setForm((f) => ({ ...f, nom: v, code: codeTouched ? f.code : autoCode(v) }));
  }

  async function handleSave() {
    if (!form.code?.trim() || !form.nom?.trim()) {
      toast.error("Code et nom requis");
      return;
    }
    const dupCode = existing.some(
      (t) => t.id !== typologie?.id && t.code.toLowerCase() === form.code.toLowerCase(),
    );
    if (dupCode) {
      toast.error(`Code "${form.code}" déjà utilisé`);
      return;
    }
    const dupNom = existing.some(
      (t) =>
        t.id !== typologie?.id &&
        t.famille === form.famille &&
        t.nom.toLowerCase() === form.nom.toLowerCase(),
    );
    if (dupNom) {
      toast.error(`Nom déjà utilisé dans cette famille`);
      return;
    }

    setSaving(true);
    const payload = { ...form, description: form.description || null };
    const res = typologie
      ? await supabase.from("typologies").update(payload).eq("id", typologie.id)
      : await supabase.from("typologies").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else {
      toast.success(typologie ? "Typologie modifiée" : "Typologie créée");
      onSaved();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{typologie ? "Modifier" : "Nouvelle"} typologie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input
              value={form.nom}
              onChange={(e) => handleNomChange(e.target.value)}
              placeholder="ex. Contreplaqué"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setForm({ ...form, code: e.target.value.toUpperCase() });
                }}
                className="font-mono"
                placeholder="CP"
              />
            </div>
            <div className="space-y-2">
              <Label>Famille *</Label>
              <Select
                value={form.famille}
                onValueChange={(v) => setForm({ ...form, famille: v as Famille })}
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
          </div>
          <div className="space-y-2">
            <Label>Description (optionnelle)</Label>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
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

export function CatalogueSubnav({
  active,
}: {
  active: "matieres" | "panneaux" | "typologies" | "etiquettes";
}) {
  const tabs = [
    { key: "typologies", to: "/catalogue/typologies", label: "Typologies" },
    { key: "matieres", to: "/catalogue/matieres", label: "Matières" },
    { key: "panneaux", to: "/catalogue/panneaux", label: "Panneaux" },
    { key: "etiquettes", to: "/catalogue/etiquettes", label: "Étiquettes QR" },
  ] as const;
  return (
    <div className="mb-4 flex gap-2 text-xs">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={
            active === t.key
              ? "px-3 py-1.5 rounded-md bg-foreground text-background font-medium"
              : "px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground"
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
