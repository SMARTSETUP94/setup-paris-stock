import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCombobox } from "@/components/ClientCombobox";
import { STATUTS, suggestNumero, sanitizeNumeroInput, isValidNumero, type StatutAffaire } from "@/lib/affaires";
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
    client_id: "",
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
          client_id: initial.client_id,
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
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!isValidNumero(form.numero)) {
      toast.error("Le numéro doit faire exactement 4 chiffres (ex. 0042)");
      return;
    }
    if (!form.client_id) {
      toast.error("Veuillez sélectionner un client");
      return;
    }
    setLoading(true);
    const payload = {
      numero: form.numero,
      nom: form.nom.trim(),
      client_id: form.client_id,
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
            <Label>Numéro (4 chiffres)</Label>
            <Input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: sanitizeNumeroInput(e.target.value) })}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="0001"
              className="font-mono"
            />
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
            <Label>Client *</Label>
            <ClientCombobox
              value={form.client_id || null}
              onChange={(id) => setForm({ ...form, client_id: id })}
            />
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
