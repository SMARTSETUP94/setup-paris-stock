import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUTS, suggestNumero, type StatutAffaire } from "@/lib/affaires";
import type { Database } from "@/integrations/supabase/types";

type Affaire = Database["public"]["Tables"]["affaires"]["Row"];
type Profile = { id: string; nom_complet: string | null; email: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Affaire | null;
  onSaved?: (a: Affaire) => void;
}

export function AffaireFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    numero: "",
    nom: "",
    client: "",
    date_debut: "",
    date_fin_prevue: "",
    statut: "devis" as StatutAffaire,
    responsable_id: "",
    budget_panneaux_ht: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, email")
        .eq("role", "admin")
        .eq("actif", true)
        .order("nom_complet");
      setAdmins((data as Profile[]) ?? []);

      if (initial) {
        setForm({
          numero: initial.numero,
          nom: initial.nom,
          client: initial.client ?? "",
          date_debut: initial.date_debut ?? "",
          date_fin_prevue: initial.date_fin_prevue ?? "",
          statut: initial.statut,
          responsable_id: initial.responsable_id ?? "",
          budget_panneaux_ht: initial.budget_panneaux_ht?.toString() ?? "",
          notes: initial.notes ?? "",
        });
      } else {
        const { data: rows } = await supabase.from("affaires").select("numero");
        const suggested = suggestNumero((rows ?? []).map((r) => r.numero));
        setForm((f) => ({ ...f, numero: suggested }));
      }
    })();
  }, [open, initial]);

  async function handleSubmit() {
    if (!form.nom.trim() || !form.numero.trim()) {
      toast.error("Numéro et nom obligatoires");
      return;
    }
    setLoading(true);
    const payload = {
      numero: form.numero.trim(),
      nom: form.nom.trim(),
      client: form.client.trim() || null,
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      statut: form.statut,
      responsable_id: form.responsable_id || null,
      budget_panneaux_ht: form.budget_panneaux_ht ? Number(form.budget_panneaux_ht) : null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = initial
      ? await supabase.from("affaires").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("affaires").insert(payload).select().single();

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial ? "Affaire mise à jour" : "Affaire créée");
    onSaved?.(data as Affaire);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Éditer l'affaire" : "Nouvelle affaire"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Numéro</Label>
            <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as StatutAffaire })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Nom *</Label>
            <Input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Ex : Stand Maison & Objet 2026"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Client</Label>
            <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div>
            <Label>Date de début</Label>
            <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
          </div>
          <div>
            <Label>Date de fin prévue</Label>
            <Input type="date" value={form.date_fin_prevue} onChange={(e) => setForm({ ...form, date_fin_prevue: e.target.value })} />
          </div>
          <div>
            <Label>Responsable</Label>
            <Select value={form.responsable_id || "none"} onValueChange={(v) => setForm({ ...form, responsable_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun</SelectItem>
                {admins.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nom_complet ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Budget panneaux HT (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.budget_panneaux_ht}
              onChange={(e) => setForm({ ...form, budget_panneaux_ht: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement…" : initial ? "Enregistrer" : "Créer l'affaire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
