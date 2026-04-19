import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/fournisseurs")({
  head: () => ({
    meta: [{ title: "Fournisseurs — Setup Stock" }],
  }),
  component: FournisseursPage,
});

type Fournisseur = Tables<"fournisseurs">;

function FournisseursPage() {
  const { ready } = useAdminGuard();
  const [items, setItems] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debSearch = useDebounced(search);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Fournisseur | null>(null);

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fournisseurs")
      .select("*")
      .order("nom", { ascending: true });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) fetchData();
  }, [ready]);

  if (!ready) return <AdminLoader />;

  const filtered = items.filter((i) => {
    const q = debSearch.toLowerCase();
    return !q || i.nom.toLowerCase().includes(q) || (i.email ?? "").toLowerCase().includes(q);
  });

  async function handleDelete() {
    if (!toDelete) return;
    const { count } = await supabase
      .from("bons_de_commande")
      .select("id", { count: "exact", head: true })
      .eq("fournisseur_id", toDelete.id);
    if (count && count > 0) {
      toast.error("Suppression impossible", {
        description: `${count} bon(s) de commande lié(s) à ce fournisseur.`,
      });
      setToDelete(null);
      return;
    }
    const { error } = await supabase.from("fournisseurs").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Fournisseur supprimé");
      fetchData();
    }
    setToDelete(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fournisseurs"
        title="Annuaire fournisseurs"
        description="Gérez les fournisseurs de panneaux et matières."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau fournisseur
          </Button>
        }
      />

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Téléphone</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">SIRET</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Notes</th>
                <th className="px-6 py-4 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  Aucun fournisseur
                </td></tr>
              )}
              {filtered.map((f, idx) => (
                <tr
                  key={f.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}
                >
                  <td className="px-6 py-4 font-medium">{f.nom}</td>
                  <td className="px-6 py-4 text-muted-foreground">{f.email ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{f.telephone ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{f.siret ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{f.notes ?? "—"}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(creating || editing) && (
        <FournisseurDialog
          fournisseur={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { fetchData(); setCreating(false); setEditing(null); }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. {toDelete?.nom} sera retiré de l'annuaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FournisseurDialog({
  fournisseur,
  onClose,
  onSaved,
}: {
  fournisseur: Fournisseur | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TablesInsert<"fournisseurs">>({
    nom: fournisseur?.nom ?? "",
    email: fournisseur?.email ?? "",
    telephone: fournisseur?.telephone ?? "",
    adresse: fournisseur?.adresse ?? "",
    siret: fournisseur?.siret ?? "",
    notes: fournisseur?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.nom?.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    const payload = {
      nom: form.nom.trim(),
      email: form.email || null,
      telephone: form.telephone || null,
      adresse: form.adresse || null,
      siret: form.siret || null,
      notes: form.notes || null,
    };
    const res = fournisseur
      ? await supabase.from("fournisseurs").update(payload).eq("id", fournisseur.id)
      : await supabase.from("fournisseurs").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else {
      toast.success(fournisseur ? "Fournisseur modifié" : "Fournisseur créé");
      onSaved();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{fournisseur ? "Modifier" : "Nouveau"} fournisseur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={form.nom ?? ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>SIRET</Label>
            <Input value={form.siret ?? ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
