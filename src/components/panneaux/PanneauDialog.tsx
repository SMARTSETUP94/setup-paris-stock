import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { FAMILLES } from "@/lib/familles";
import type { Typologie } from "@/lib/typologies";
import type { CatRow, Matiere } from "./types";

export function PanneauDialog({
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
    else {
      toast.success(panneau ? "Panneau modifié" : "Panneau créé");
      onSaved();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{panneau ? "Modifier" : "Nouveau"} panneau</DialogTitle>
        </DialogHeader>
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
                {matiereOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.libelle}</SelectItem>)}
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
