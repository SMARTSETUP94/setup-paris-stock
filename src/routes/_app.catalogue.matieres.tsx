import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Search, Loader2, Upload, Boxes } from "lucide-react";
import { toast } from "sonner";
import { FAMILLES, UNITES, slugCode, type Famille, type UniteStock } from "@/lib/familles";

export const Route = createFileRoute("/_app/catalogue/matieres")({
  head: () => ({ meta: [{ title: "Matières — Setup Stock" }] }),
  component: MatieresPage,
});

type Matiere = Tables<"matieres">;

function MatieresPage() {
  const { ready } = useAdminGuard();
  const navigate = useNavigate();
  const [items, setItems] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debSearch = useDebounced(search);
  const [familleFilter, setFamilleFilter] = useState<string>("all");
  const [actifFilter, setActifFilter] = useState<"all" | "yes" | "no">("yes");
  const [editing, setEditing] = useState<Matiere | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("matieres")
      .select("*")
      .order("code", { ascending: true });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { if (ready) fetchData(); }, [ready]);

  if (!ready) return <AdminLoader />;

  const filtered = items.filter((m) => {
    const q = debSearch.toLowerCase();
    if (q && !m.code.toLowerCase().includes(q) && !m.libelle.toLowerCase().includes(q)) return false;
    if (familleFilter !== "all" && m.famille !== familleFilter) return false;
    if (actifFilter === "yes" && !m.actif) return false;
    if (actifFilter === "no" && m.actif) return false;
    return true;
  });

  async function toggleActif(m: Matiere) {
    const { error } = await supabase.from("matieres").update({ actif: !m.actif }).eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, actif: !x.actif } : x)));
      toast.success(m.actif ? "Matière désactivée" : "Matière activée");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Matières"
        description="Référencez vos matières premières et leur seuil d'alerte."
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

      <div className="mb-4 flex gap-2 text-xs">
        <Link to="/catalogue/matieres" className="px-3 py-1.5 rounded-md bg-foreground text-background font-medium">Matières</Link>
        <Link to="/catalogue/panneaux" className="px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground">Panneaux</Link>
        <Link to="/catalogue/etiquettes" className="px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground">Étiquettes QR</Link>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_140px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher code ou libellé…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={familleFilter} onValueChange={setFamilleFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes familles</SelectItem>
            {FAMILLES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actifFilter} onValueChange={(v) => setActifFilter(v as typeof actifFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Actives</SelectItem>
            <SelectItem value="no">Inactives</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Code</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Libellé</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Famille</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Épaisseur</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Unité</th>
                <th className="text-right px-6 py-4 font-medium text-muted-foreground">Seuil</th>
                <th className="text-center px-6 py-4 font-medium text-muted-foreground">Actif</th>
                <th className="px-6 py-4 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">Aucune matière</td></tr>}
              {filtered.map((m, idx) => (
                <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""} ${!m.actif ? "opacity-60" : ""}`}>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-0.5 rounded font-mono text-xs bg-muted">{m.code}</span>
                  </td>
                  <td className="px-6 py-4 font-medium">{m.libelle}</td>
                  <td className="px-6 py-4"><FamilleBadge famille={m.famille} /></td>
                  <td className="px-6 py-4 text-right">{m.epaisseur_mm} mm</td>
                  <td className="px-6 py-4 text-muted-foreground">{UNITES.find((u) => u.value === m.unite_stock)?.label ?? m.unite_stock}</td>
                  <td className="px-6 py-4 text-right">{m.seuil_alerte}</td>
                  <td className="px-6 py-4 text-center">
                    <Switch checked={m.actif} onCheckedChange={() => toggleActif(m)} />
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/catalogue/panneaux", search: { matiere: m.id } as never })}>
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
      </Card>

      {(creating || editing) && (
        <MatiereDialog
          matiere={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { fetchData(); setCreating(false); setEditing(null); }}
        />
      )}

      {importing && (
        <ImportDialog<TablesInsert<"matieres">>
          open
          onClose={() => { setImporting(false); fetchData(); }}
          title="Importer des matières"
          description="Format CSV ou XLSX. Les matières existantes (même code) sont marquées comme doublons."
          expectedColumns={["code", "libelle", "famille", "epaisseur_mm", "unite_stock", "seuil_alerte", "actif"]}
          validateRow={async (raw) => {
            const errors: string[] = [];
            const code = String(raw.code ?? "").trim();
            if (!code) errors.push("Code requis");
            const libelle = String(raw.libelle ?? "").trim();
            if (!libelle) errors.push("Libellé requis");
            const famille = String(raw.famille ?? "autre").trim() as Famille;
            if (!FAMILLES.find((f) => f.value === famille)) errors.push("Famille invalide");
            const ep = Number(String(raw.epaisseur_mm ?? "").replace(",", "."));
            if (!Number.isFinite(ep) || ep <= 0) errors.push("Épaisseur invalide");
            const unite = String(raw.unite_stock ?? "m2").trim() as UniteStock;
            if (!UNITES.find((u) => u.value === unite)) errors.push("Unité invalide");
            const seuil = Number(String(raw.seuil_alerte ?? "0").replace(",", "."));
            const actifStr = String(raw.actif ?? "true").trim().toLowerCase();
            const actif = !["false", "0", "non", "no"].includes(actifStr);
            const isDuplicate = items.some((m) => m.code.toLowerCase() === code.toLowerCase());
            return {
              data: errors.length ? null : { code, libelle, famille, epaisseur_mm: ep, unite_stock: unite, seuil_alerte: seuil, actif },
              errors,
              isDuplicate,
            };
          }}
          columnsPreview={[
            { key: "code", label: "Code" },
            { key: "libelle", label: "Libellé" },
            { key: "famille", label: "Famille", render: (d) => <FamilleBadge famille={d.famille} /> },
            { key: "epaisseur_mm", label: "Épaisseur" },
            { key: "unite_stock", label: "Unité" },
          ]}
          importRows={async (rows: ImportRow<TablesInsert<"matieres">>[]) => {
            let inserted = 0, updated = 0, skipped = 0, errors = 0;
            for (const r of rows) {
              if (!r.data) { skipped++; continue; }
              if (r.action === "overwrite") {
                const { error } = await supabase.from("matieres").update(r.data).eq("code", r.data.code);
                if (error) errors++; else updated++;
              } else if (r.action === "create") {
                const { error } = await supabase.from("matieres").insert(r.data);
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

function MatiereDialog({ matiere, onClose, onSaved }: { matiere: Matiere | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TablesInsert<"matieres">>({
    code: matiere?.code ?? "",
    libelle: matiere?.libelle ?? "",
    famille: matiere?.famille ?? "autre",
    epaisseur_mm: matiere?.epaisseur_mm ?? 0,
    unite_stock: matiere?.unite_stock ?? "m2",
    seuil_alerte: matiere?.seuil_alerte ?? 0,
    actif: matiere?.actif ?? true,
    densite_kg_m3: matiere?.densite_kg_m3 ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [codeTouched, setCodeTouched] = useState(!!matiere);

  function handleLibelleChange(v: string) {
    setForm((f) => ({
      ...f,
      libelle: v,
      code: codeTouched ? f.code : slugCode(v, f.epaisseur_mm),
    }));
  }
  function handleEpaisseurChange(v: string) {
    const n = Number(v.replace(",", "."));
    setForm((f) => ({
      ...f,
      epaisseur_mm: Number.isFinite(n) ? n : 0,
      code: codeTouched ? f.code : slugCode(f.libelle, n),
    }));
  }

  async function handleSave() {
    if (!form.code?.trim() || !form.libelle?.trim() || !form.epaisseur_mm) {
      toast.error("Code, libellé et épaisseur sont requis");
      return;
    }
    setSaving(true);
    const res = matiere
      ? await supabase.from("matieres").update(form).eq("id", matiere.id)
      : await supabase.from("matieres").insert(form);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(matiere ? "Matière modifiée" : "Matière créée"); onSaved(); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{matiere ? "Modifier" : "Nouvelle"} matière</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Libellé *</Label>
            <Input value={form.libelle} onChange={(e) => handleLibelleChange(e.target.value)} placeholder="ex. MDF brut" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => { setCodeTouched(true); setForm({ ...form, code: e.target.value.toUpperCase() }); }}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Épaisseur (mm) *</Label>
              <Input type="text" inputMode="decimal" value={form.epaisseur_mm ?? ""} onChange={(e) => handleEpaisseurChange(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Famille</Label>
              <Select value={form.famille ?? "autre"} onValueChange={(v) => setForm({ ...form, famille: v as Famille })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FAMILLES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unité de stock</Label>
              <Select value={form.unite_stock ?? "m2"} onValueChange={(v) => setForm({ ...form, unite_stock: v as UniteStock })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Seuil d'alerte</Label>
              <Input type="number" value={form.seuil_alerte ?? 0} onChange={(e) => setForm({ ...form, seuil_alerte: Number(e.target.value) })} />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>Active</Label>
              <div className="h-10 flex items-center">
                <Switch checked={form.actif ?? true} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
              </div>
            </div>
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
