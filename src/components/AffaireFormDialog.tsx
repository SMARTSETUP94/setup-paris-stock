import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUTS, suggestCodeChantier, type StatutAffaire } from "@/lib/affaires";
import type { Database } from "@/integrations/supabase/types";

type Affaire = Database["public"]["Tables"]["affaires"]["Row"];
type Profile = { id: string; nom_complet: string | null; email: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Affaire | null;
  onSaved?: (a: Affaire) => void;
}

const FREE_TEXT = "__libre__";

export function AffaireFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [clientsExistants, setClientsExistants] = useState<string[]>([]);
  const [chargeMode, setChargeMode] = useState<"profile" | "libre" | "none">("none");
  const [form, setForm] = useState({
    code_chantier: "",
    nom: "",
    client: "",
    adresse: "",
    charge_affaires_id: "",
    charge_affaires_libre: "",
    code_interne: "",
    statut: "en_cours" as StatutAffaire,
    budget_panneaux_ht: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [adminRes, clientsRes, numerosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nom_complet, email")
          .eq("role", "admin")
          .eq("actif", true)
          .order("nom_complet"),
        supabase.from("affaires").select("client").not("client", "is", null),
        supabase.from("affaires").select("numero").not("numero", "is", null),
      ]);
      setAdmins((adminRes.data as Profile[]) ?? []);
      // dedup clients pour l'autocomplete
      const set = new Set<string>();
      for (const r of (clientsRes.data ?? []) as { client: string | null }[]) {
        if (r.client && r.client.trim()) set.add(r.client.trim());
      }
      setClientsExistants(Array.from(set).sort((a, b) => a.localeCompare(b, "fr")));

      if (initial) {
        setForm({
          code_chantier: initial.code_chantier ?? "",
          nom: initial.nom,
          client: initial.client ?? "",
          adresse: initial.adresse ?? "",
          charge_affaires_id: initial.charge_affaires_id ?? "",
          charge_affaires_libre: initial.charge_affaires_libre ?? "",
          code_interne: initial.code_interne ?? "",
          statut: initial.statut,
          budget_panneaux_ht: initial.budget_panneaux_ht?.toString() ?? "",
          notes: initial.notes ?? "",
        });
        setChargeMode(
          initial.charge_affaires_id ? "profile" : initial.charge_affaires_libre ? "libre" : "none",
        );
      } else {
        const nums = ((numerosRes.data ?? []) as { numero: string | null }[]).map((r) => r.numero);
        setForm((f) => ({ ...f, code_chantier: suggestCodeChantier(nums) }));
        setChargeMode("none");
      }
    })();
  }, [open, initial]);

  const filteredClients = useMemo(() => {
    const q = form.client.trim().toLowerCase();
    if (!q) return [];
    return clientsExistants
      .filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q)
      .slice(0, 8);
  }, [form.client, clientsExistants]);

  async function handleSubmit() {
    if (!form.code_chantier.trim()) {
      toast.error("Le code chantier est obligatoire");
      return;
    }
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!form.client.trim()) {
      toast.error("Le client est obligatoire");
      return;
    }
    setLoading(true);
    const payload = {
      code_chantier: form.code_chantier.trim(),
      nom: form.nom.trim(),
      client: form.client.trim(),
      adresse: form.adresse.trim() || null,
      charge_affaires_id:
        chargeMode === "profile" && form.charge_affaires_id ? form.charge_affaires_id : null,
      charge_affaires_libre:
        chargeMode === "libre" && form.charge_affaires_libre.trim()
          ? form.charge_affaires_libre.trim()
          : null,
      code_interne: form.code_interne.trim() || null,
      statut: form.statut,
      budget_panneaux_ht: form.budget_panneaux_ht ? Number(form.budget_panneaux_ht) : null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = initial
      ? await supabase.from("affaires").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("affaires").insert(payload).select().single();

    setLoading(false);
    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        toast.error("Ce code chantier existe déjà");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(initial ? "Affaire mise à jour" : "Affaire créée");
    onSaved?.(data as Affaire);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Éditer l'affaire" : "Nouvelle affaire"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Code chantier *</Label>
            <Input
              value={form.code_chantier}
              onChange={(e) => setForm({ ...form, code_chantier: e.target.value })}
              placeholder="9198_Stand Maison & Objet"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Format libre. Le préfixe numérique sera extrait automatiquement pour le tri.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Nom *</Label>
            <Input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Stand Maison & Objet 2026"
            />
          </div>
          <div className="sm:col-span-2 relative">
            <Label>Client *</Label>
            <Input
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              placeholder="Nom du client (texte libre)"
              autoComplete="off"
              list="clients-autocomplete"
            />
            {filteredClients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, client: c })}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Adresse du chantier</Label>
            <Input
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              placeholder="Rue, code postal, ville"
            />
          </div>
          <div>
            <Label>Chargé d'affaires</Label>
            <Select
              value={
                chargeMode === "profile"
                  ? form.charge_affaires_id || "none"
                  : chargeMode === "libre"
                    ? FREE_TEXT
                    : "none"
              }
              onValueChange={(v) => {
                if (v === "none") {
                  setChargeMode("none");
                  setForm({ ...form, charge_affaires_id: "", charge_affaires_libre: "" });
                } else if (v === FREE_TEXT) {
                  setChargeMode("libre");
                  setForm({ ...form, charge_affaires_id: "" });
                } else {
                  setChargeMode("profile");
                  setForm({ ...form, charge_affaires_id: v, charge_affaires_libre: "" });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun</SelectItem>
                {admins.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom_complet ?? p.email}
                  </SelectItem>
                ))}
                <SelectItem value={FREE_TEXT}>Autre (texte libre)</SelectItem>
              </SelectContent>
            </Select>
            {chargeMode === "libre" && (
              <Input
                className="mt-2"
                value={form.charge_affaires_libre}
                onChange={(e) => setForm({ ...form, charge_affaires_libre: e.target.value })}
                placeholder="Nom du chargé d'affaires"
              />
            )}
          </div>
          <div>
            <Label>Code interne</Label>
            <Input
              value={form.code_interne}
              onChange={(e) => setForm({ ...form, code_interne: e.target.value })}
              placeholder="#1036"
            />
          </div>
          <div>
            <Label>Statut</Label>
            <Select
              value={form.statut}
              onValueChange={(v) => setForm({ ...form, statut: v as StatutAffaire })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement…" : initial ? "Enregistrer" : "Créer l'affaire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
