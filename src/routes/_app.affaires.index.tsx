import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatutBadge } from "@/components/StatutBadge";
import { AffaireFormDialog } from "@/components/AffaireFormDialog";
import { STATUTS, formatDateFr } from "@/lib/affaires";
import { formatEuro } from "@/lib/familles";
import type { Database } from "@/integrations/supabase/types";

type Affaire = Database["public"]["Tables"]["affaires"]["Row"] & {
  responsable?: { nom_complet: string | null; email: string } | null;
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
  const [openCreate, setOpenCreate] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("affaires")
      .select("*, responsable:profiles!affaires_responsable_id_fkey(nom_complet, email)")
      .order("date_debut", { ascending: false, nullsFirst: false });
    setRows((data as Affaire[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  const filtered = useMemo(() => {
    const q = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (statut !== "all" && r.statut !== statut) return false;
      if (!q) return true;
      return (
        r.numero.toLowerCase().includes(q) ||
        r.nom.toLowerCase().includes(q) ||
        (r.client ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, dq, statut]);

  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Affaires"
        title="Affaires"
        description="Pilotez chaque chantier : budget, statut, mouvements et accès tiers."
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" /> Nouvelle affaire
          </Button>
        }
      />

      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher par numéro, nom ou client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin prévue</TableHead>
              <TableHead className="text-right">Budget HT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune affaire</TableCell></TableRow>
            ) : (
              filtered.map((r, idx) => (
                <TableRow
                  key={r.id}
                  className={idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}
                >
                  <TableCell>
                    <Link
                      to="/affaires/$numero"
                      params={{ numero: r.numero }}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-muted hover:bg-foreground/10"
                    >
                      {r.numero}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link to="/affaires/$numero" params={{ numero: r.numero }} className="font-medium hover:underline">
                      {r.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.client ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.responsable?.nom_complet ?? r.responsable?.email ?? "—"}
                  </TableCell>
                  <TableCell><StatutBadge value={r.statut} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDateFr(r.date_debut)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateFr(r.date_fin_prevue)}</TableCell>
                  <TableCell className="text-right font-medium">{formatEuro(r.budget_panneaux_ht)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AffaireFormDialog open={openCreate} onOpenChange={setOpenCreate} onSaved={() => void load()} />
    </div>
  );
}
