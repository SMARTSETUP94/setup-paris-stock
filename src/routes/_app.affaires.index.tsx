import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AffaireFormDialog } from "@/components/AffaireFormDialog";
import { AffairesImportDialog } from "@/components/AffairesImportDialog";
import { STATUTS } from "@/lib/affaires";
import type { Database } from "@/integrations/supabase/types";

type StatutAffaire = Database["public"]["Enums"]["statut_affaire"];

type Affaire = Database["public"]["Tables"]["affaires"]["Row"] & {
  charge?: { nom_complet: string | null; email: string } | null;
};

export const Route = createFileRoute("/_app/affaires/")({
  head: () => ({ meta: [{ title: "Affaires — Setup Stock" }] }),
  component: AffairesIndex,
});

function AffairesIndex() {
  const { ready } = useAdminGuard();
  const [rows, setRows] = useState<Affaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const dq = useDebounced(search, 250);
  const [statut, setStatut] = useState<string>("all");
  const [chargeFilter, setChargeFilter] = useState<string>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("affaires")
      .select("*, charge:profiles!affaires_charge_affaires_id_fkey(nom_complet, email)")
      .order("numero", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setRows((data as Affaire[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  async function changeStatut(id: string, value: StatutAffaire) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, statut: value } : r)));
    const { error } = await supabase.from("affaires").update({ statut: value }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("Impossible de mettre à jour le statut");
    } else {
      toast.success("Statut mis à jour");
    }
  }

  const chargesOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.charge_affaires_id && r.charge) {
        map.set(r.charge_affaires_id, r.charge.nom_complet ?? r.charge.email);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (statut !== "all" && r.statut !== statut) return false;
      if (chargeFilter !== "all") {
        if (chargeFilter === "__libre__") {
          if (!r.charge_affaires_libre) return false;
        } else if (chargeFilter === "__none__") {
          if (r.charge_affaires_id || r.charge_affaires_libre) return false;
        } else if (r.charge_affaires_id !== chargeFilter) return false;
      }
      if (!q) return true;
      const haystack = [
        r.code_chantier,
        r.nom,
        r.client,
        r.adresse ?? "",
        r.numero ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, dq, statut, chargeFilter]);

  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Affaires"
        title="Affaires"
        description="Pilotez chaque chantier : budget, statut, mouvements et accès tiers."
        actions={
          <>
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4" /> Importer un CSV
            </Button>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" /> Nouvelle affaire
            </Button>
          </>
        }
      />

      <Card className="p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher code, nom, client, adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={chargeFilter} onValueChange={setChargeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous chargés d'affaires</SelectItem>
              <SelectItem value="__none__">— Aucun</SelectItem>
              <SelectItem value="__libre__">Texte libre uniquement</SelectItem>
              {chargesOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code chantier</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Chargé d'affaires</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Début</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune affaire</TableCell></TableRow>
              ) : (
                filtered.map((r, idx) => (
                  <TableRow key={r.id} className={idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}>
                    <TableCell>
                      <Link
                        to="/affaires/$code"
                        params={{ code: r.code_chantier }}
                        className="font-mono text-xs px-2 py-0.5 rounded bg-muted hover:bg-foreground/10 inline-block max-w-[220px] truncate align-middle"
                        title={r.code_chantier}
                      >
                        {r.code_chantier}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <Link to="/affaires/$code" params={{ code: r.code_chantier }} className="font-medium hover:underline truncate block" title={r.nom}>
                        {r.nom}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate" title={r.client}>
                      {r.client}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px]">
                      {r.charge ? (
                        <span className="truncate block" title={r.charge.nom_complet ?? r.charge.email}>
                          {r.charge.nom_complet ?? r.charge.email}
                        </span>
                      ) : r.charge_affaires_libre ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="Non matché à un profil">
                          <AlertTriangle className="h-3 w-3" /> {r.charge_affaires_libre}
                        </span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell><StatutBadge value={r.statut} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateFr(r.date_debut)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground mt-3">{filtered.length} affaire(s) affichée(s)</p>

      <AffaireFormDialog open={openCreate} onOpenChange={setOpenCreate} onSaved={() => void load()} />
      <AffairesImportDialog open={openImport} onClose={() => setOpenImport(false)} onImported={() => void load()} />
    </div>
  );
}
