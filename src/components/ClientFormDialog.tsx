import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Client | null;
  presetNom?: string;
  onSaved?: (client: Client) => void;
  /** Mini = formulaire compact pour création rapide depuis l'AffaireFormDialog */
  variant?: "full" | "mini";
}

export function ClientFormDialog({ open, onOpenChange, initial, presetNom, onSaved, variant = "full" }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    contact_principal: "",
    email: "",
    telephone: "",
    adresse: "",
    siret: "",
    notes: "",
    actif: true,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        nom: initial.nom,
        contact_principal: initial.contact_principal ?? "",
        email: initial.email ?? "",
        telephone: initial.telephone ?? "",
        adresse: initial.adresse ?? "",
        siret: initial.siret ?? "",
        notes: initial.notes ?? "",
        actif: initial.actif,
      });
    } else {
      setForm({
        nom: presetNom ?? "",
        contact_principal: "",
        email: "",
        telephone: "",
        adresse: "",
        siret: "",
        notes: "",
        actif: true,
      });
    }
  }, [open, initial, presetNom]);

  async function handleSubmit() {
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setLoading(true);
    const payload = {
      nom: form.nom.trim(),
      contact_principal: form.contact_principal.trim() || null,
      email: form.email.trim() || null,
      telephone: form.telephone.trim() || null,
      adresse: form.adresse.trim() || null,
      siret: form.siret.trim() || null,
      notes: form.notes.trim() || null,
      actif: form.actif,
    };
    const { data, error } = initial
      ? await supabase.from("clients").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("clients").insert(payload).select().single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial ? "Client mis à jour" : "Client créé");
    onSaved?.(data as Client);
    onOpenChange(false);
  }

  const isMini = variant === "mini";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMini ? "max-w-md" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>{initial ? "Éditer le client" : isMini ? "Créer un client rapidement" : "Nouveau client"}</DialogTitle>
        </DialogHeader>
        <div className={`grid gap-4 ${isMini ? "" : "sm:grid-cols-2"}`}>
          <div className={isMini ? "" : "sm:col-span-2"}>
            <Label>Nom *</Label>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Disney France" />
          </div>
          <div>
            <Label>Contact principal</Label>
            <Input value={form.contact_principal} onChange={(e) => setForm({ ...form, contact_principal: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {!isMini && (
            <>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </div>
              <div>
                <Label>SIRET</Label>
                <Input value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Adresse</Label>
                <Textarea value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              {initial && (
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">Client actif</span>
                  <Switch checked={form.actif} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement…" : initial ? "Enregistrer" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
