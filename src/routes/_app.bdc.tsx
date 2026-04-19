import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Loader2, FileText } from "lucide-react";
import { StatutBdcBadge } from "@/components/StatutBdcBadge";
import { STATUTS_BDC } from "@/lib/bdc";
import { formatEuro } from "@/lib/familles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewBdcDialog } from "@/components/NewBdcDialog";

export const Route = createFileRoute("/_app/bdc")({
  head: () => ({ meta: [{ title: "Bons de commande — Setup Stock" }] }),
  component: BdcListPage,
});

type BdcRow = {
  id: string;
  numero_bdc: string | null;
  date_bdc: string | null;
  statut: string;
  montant_ht_total: number | null;
  created_at: string;
  fournisseur: { nom: string } | null;
  affaire: { code_chantier: string; nom: string } | null;
  cree_par_profile: { nom_complet: string | null; email: string } | null;
};

function BdcListPage() {
  const { ready } = useAdminGuard();
  const [items, setItems] = useState<BdcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debSearch = useDebounced(search);
  const [statutFilter, setStatutFilter] = useState<string>("__all__");
  const [creating, setCreating] = useState(false);

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bons_de_commande")
      .select(`
        id, numero_bdc, date_bdc, statut, montant_ht_total, created_at,
        fournisseur:fournisseurs(nom),
        affaire:affaires(code_chantier, nom),
        cree_par_profile:profiles!bons_de_commande_cree_par_fkey(nom_complet, email)
      `)
      .order("created_at", { ascending: false });
    if (!error) setItems((data as unknown as BdcRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) fetchData();
  }, [ready]);

  const filtered = useMemo(() => {
    const q = debSearch.toLowerCase().trim();
    return items.filter((b) => {
      if (statutFilter !== "__all__" && b.statut !== statutFilter) return false;
      if (!q) return true;
      return (
        (b.numero_bdc ?? "").toLowerCase().includes(q) ||
        (b.fournisseur?.nom ?? "").toLowerCase().includes(q) ||
        (b.affaire?.code_chantier ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, debSearch, statutFilter]);

  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Bons de commande"
        title="Bons de commande"
        description="Uploadez un PDF, l'OCR extrait les lignes, vous validez."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau BDC
          </Button>
        }
      />

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="N° BDC, fournisseur, affaire…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous statuts</SelectItem>
            {STATUTS_BDC.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">N° BDC</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fournisseur</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Affaire</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Montant HT</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créé par</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Aucun bon de commande
                </td></tr>
              )}
              {filtered.map((b, idx) => (
                <tr
                  key={b.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link to="/bdc/$id" params={{ id: b.id }} className="font-mono text-xs hover:underline">
                      {b.numero_bdc ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{b.fournisseur?.nom ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.date_bdc ? new Date(b.date_bdc).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {b.affaire?.code_chantier ?? "—"}
                  </td>
                  <td className="px-4 py-3"><StatutBdcBadge value={b.statut} /></td>
                  <td className="px-4 py-3 text-right font-mono">
                    {b.montant_ht_total !== null ? formatEuro(b.montant_ht_total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {b.cree_par_profile?.nom_complet ?? b.cree_par_profile?.email ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && (
        <NewBdcDialog
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); fetchData(); }}
        />
      )}
    </div>
  );
}
