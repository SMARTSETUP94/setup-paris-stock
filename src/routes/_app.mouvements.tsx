import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Download, FileSpreadsheet, FileText, ArrowDownToLine, ArrowUpFromLine, Wrench, Recycle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { TypeMouvementBadge } from "@/components/TypeMouvementBadge";
import { NumeroAffairePill } from "@/components/NumeroAffairePill";
import { MouvementDialog } from "@/components/MouvementDialog";
import { TYPES_MVT } from "@/lib/mouvements";
import { formatEuro, formatNumber } from "@/lib/familles";
import { formatDateTimeFr } from "@/lib/affaires";
import { useAuth } from "@/hooks/useAuth";
import {
  exportMouvementsXLSX, exportMouvementsCSV, exportMouvementsPDF,
  type MouvementExport,
} from "@/lib/mouvements-export";

export const Route = createFileRoute("/_app/mouvements")({
  head: () => ({ meta: [{ title: "Mouvements — Setup Stock" }] }),
  component: MouvementsPage,
});

type Row = {
  id: string;
  created_at: string;
  type: string;
  quantite: number;
  prix_unitaire_ht: number | null;
  cump_avant: number | null;
  cump_apres: number | null;
  valeur_ligne_ht: number | null;
  commentaire: string | null;
  panneau_id: string;
  affaire_id: string | null;
  effectue_par: string | null;
  panneau?: {
    longueur_mm: number;
    largeur_mm: number;
    matiere?: { code: string; libelle: string; unite_stock: string } | null;
  } | null;
  affaire?: { numero: string; nom: string } | null;
  operateur?: { nom_complet: string | null; email: string } | null;
};

function MouvementsPage() {
  const { ready } = useAdminGuard();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const dq = useDebounced(search, 250);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [affaireFilter, setAffaireFilter] = useState<string>("all");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [openMode, setOpenMode] = useState<"entree" | "sortie" | "correction" | null>(null);
  const [affairesOpts, setAffairesOpts] = useState<{ id: string; numero: string; nom: string }[]>([]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("mouvements_stock")
      .select(`
        id, created_at, type, quantite, prix_unitaire_ht, cump_avant, cump_apres,
        valeur_ligne_ht, commentaire, panneau_id, affaire_id, effectue_par,
        panneau:panneaux!mouvements_stock_panneau_id_fkey(
          longueur_mm, largeur_mm,
          matiere:matieres!panneaux_matiere_id_fkey(code, libelle, unite_stock)
        ),
        affaire:affaires!mouvements_stock_affaire_id_fkey(numero, nom),
        operateur:profiles!mouvements_stock_effectue_par_fkey(nom_complet, email)
      `)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (dateDebut) q = q.gte("created_at", `${dateDebut}T00:00:00Z`);
    if (dateFin) q = q.lte("created_at", `${dateFin}T23:59:59Z`);
    if (typeFilter !== "all") q = q.eq("type", typeFilter as Row["type"]);
    if (affaireFilter !== "all") q = q.eq("affaire_id", affaireFilter);

    const { data, error } = await q;
    if (error) console.error(error);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  }

  async function loadAffairesOpts() {
    const { data } = await supabase
      .from("affaires")
      .select("id, numero, nom")
      .order("numero", { ascending: false });
    setAffairesOpts((data as { id: string; numero: string; nom: string }[]) ?? []);
  }

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, typeFilter, affaireFilter, dateDebut, dateFin]);

  useEffect(() => {
    if (ready) void loadAffairesOpts();
  }, [ready]);

  const filtered = useMemo(() => {
    const ql = dq.trim().toLowerCase();
    if (!ql) return rows;
    return rows.filter((r) => {
      const code = r.panneau?.matiere?.code ?? "";
      const lib = r.panneau?.matiere?.libelle ?? "";
      const aff = `${r.affaire?.numero ?? ""} ${r.affaire?.nom ?? ""}`;
      const com = r.commentaire ?? "";
      return [code, lib, aff, com].some((s) => s.toLowerCase().includes(ql));
    });
  }, [rows, dq]);

  function toExport(): MouvementExport[] {
    return filtered.map((r) => ({
      date: r.created_at,
      type: r.type,
      matiere_code: r.panneau?.matiere?.code ?? "",
      matiere_libelle: r.panneau?.matiere?.libelle ?? "",
      dimensions: r.panneau ? `${r.panneau.longueur_mm}×${r.panneau.largeur_mm}` : "",
      quantite: Number(r.quantite),
      unite: r.panneau?.matiere?.unite_stock ?? "",
      affaire_numero: r.affaire?.numero ?? "",
      affaire_nom: r.affaire?.nom ?? "",
      cump_avant: r.cump_avant !== null ? Number(r.cump_avant) : null,
      cump_apres: r.cump_apres !== null ? Number(r.cump_apres) : null,
      prix_unitaire_ht: r.prix_unitaire_ht !== null ? Number(r.prix_unitaire_ht) : null,
      valeur_ligne_ht: r.valeur_ligne_ht !== null ? Number(r.valeur_ligne_ht) : null,
      operateur: r.operateur?.nom_complet ?? r.operateur?.email ?? "",
      commentaire: r.commentaire ?? "",
    }));
  }

  function filtersSummary() {
    const parts: string[] = [];
    if (dateDebut || dateFin) parts.push(`Période : ${dateDebut || "…"} → ${dateFin || "…"}`);
    if (typeFilter !== "all") parts.push(`Type : ${TYPES_MVT.find((t) => t.value === typeFilter)?.label ?? ""}`);
    if (affaireFilter !== "all") {
      const a = affairesOpts.find((x) => x.id === affaireFilter);
      if (a) parts.push(`Affaire : ${a.numero} ${a.nom}`);
    }
    if (dq) parts.push(`Recherche : « ${dq} »`);
    return parts.join(" · ");
  }

  if (!ready) return <AdminLoader />;

  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <PageHeader
        eyebrow="Mouvements"
        title="Mouvements de stock"
        description="Entrées, sorties, corrections et chutes. Chaque ligne est immuable et valorisée au CUMP."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4" /> Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportMouvementsXLSX(toExport(), { dateDebut, dateFin })}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> XLSX (3 feuilles)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportMouvementsCSV(toExport(), { dateDebut, dateFin })}>
                  <FileText className="h-4 w-4 mr-2" /> CSV (UTF-8)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportMouvementsPDF(toExport(), { dateDebut, dateFin, filtersSummary: filtersSummary() })}>
                  <FileText className="h-4 w-4 mr-2" /> PDF (paysage)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Nouveau mouvement
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setOpenMode("entree")}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Entrée
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOpenMode("sortie")}>
                  <ArrowUpFromLine className="h-4 w-4 mr-2" /> Sortie
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOpenMode("correction")}>
                  <Wrench className="h-4 w-4 mr-2" /> Correction
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Card className="p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_220px_160px_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher matière, affaire, commentaire…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {TYPES_MVT.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={affaireFilter} onValueChange={setAffaireFilter}>
            <SelectTrigger><SelectValue placeholder="Toutes affaires" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes affaires</SelectItem>
              {affairesOpts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono text-xs mr-2">{a.numero}</span>
                  {a.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} placeholder="Du" />
          <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} placeholder="Au" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead>Affaire</TableHead>
                <TableHead className="text-right">CUMP avant</TableHead>
                <TableHead className="text-right">CUMP après</TableHead>
                <TableHead className="text-right">Valeur HT</TableHead>
                <TableHead>Opérateur</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Aucun mouvement</TableCell></TableRow>
              ) : (
                filtered.map((r, idx) => (
                  <TableRow key={r.id} className={idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeFr(r.created_at)}</TableCell>
                    <TableCell><TypeMouvementBadge value={r.type} /></TableCell>
                    <TableCell>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted mr-2">{r.panneau?.matiere?.code}</span>
                      <span className="text-muted-foreground">{r.panneau?.matiere?.libelle}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {r.panneau ? `${r.panneau.longueur_mm}×${r.panneau.largeur_mm}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${Number(r.quantite) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {Number(r.quantite) > 0 ? "+" : ""}{formatNumber(Number(r.quantite), 2)}
                    </TableCell>
                    <TableCell>
                      {r.affaire ? <NumeroAffairePill numero={r.affaire.numero} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.cump_avant !== null ? formatEuro(Number(r.cump_avant)) : "—"}</TableCell>
                    <TableCell className="text-right">{r.cump_apres !== null ? formatEuro(Number(r.cump_apres)) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{r.valeur_ligne_ht !== null ? formatEuro(Number(r.valeur_ligne_ht)) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {r.operateur?.nom_complet ?? r.operateur?.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {r.commentaire ?? ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground mt-3">
        {filtered.length} mouvement(s) affiché(s) · Lignes immuables (UPDATE/DELETE bloqués par RLS)
      </p>

      <MouvementDialog
        open={openMode !== null}
        onOpenChange={(v) => { if (!v) setOpenMode(null); }}
        mode={openMode ?? "entree"}
        isAdmin={isAdmin}
        userId={user?.id ?? null}
        onCreated={() => void load()}
      />
    </div>
  );
}
