import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Edit, MoreHorizontal, Plus, Trash2, Archive, RefreshCw, Ban, ArrowDownToLine, ArrowUpFromLine, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatutBadge } from "@/components/StatutBadge";
import { AffaireFormDialog } from "@/components/AffaireFormDialog";
import { InviteTiersDialog } from "@/components/InviteTiersDialog";
import { MouvementDialog } from "@/components/MouvementDialog";
import { TypeMouvementBadge } from "@/components/TypeMouvementBadge";
import { formatDateFr, formatDateTimeFr, permissionLabel, buildInvitationLink } from "@/lib/affaires";
import { formatEuro, formatNumber } from "@/lib/familles";
import type { Database } from "@/integrations/supabase/types";

type Affaire = Database["public"]["Tables"]["affaires"]["Row"] & {
  charge?: { nom_complet: string | null; email: string } | null;
};
type Acces = Database["public"]["Tables"]["affaire_acces"]["Row"];

type StockLigne = {
  panneau_id: string | null;
  matiere_id: string | null;
  qte_entree: number | null;
  qte_sortie: number | null;
  reliquat: number | null;
  surface_m2_totale: number | null;
  valeur_consommee_ht: number | null;
  panneau?: {
    longueur_mm: number;
    largeur_mm: number;
    cump_ht: number | null;
    matiere?: { code: string; libelle: string; unite_stock: string } | null;
  } | null;
};

type MvtRecent = {
  id: string;
  created_at: string;
  type: string;
  quantite: number;
  valeur_ligne_ht: number | null;
  commentaire: string | null;
  panneau?: { longueur_mm: number; largeur_mm: number; matiere?: { code: string; libelle: string } | null } | null;
};

export const Route = createFileRoute("/_app/affaires/$code")({
  head: () => ({ meta: [{ title: "Affaire — Setup Stock" }] }),
  component: AffaireDetail,
});

function AffaireDetail() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { ready } = useAdminGuard();
  const { user, profile } = useAuth();
  const [affaire, setAffaire] = useState<Affaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [accesList, setAccesList] = useState<Acces[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stockLignes, setStockLignes] = useState<StockLigne[]>([]);
  const [mvtRecent, setMvtRecent] = useState<MvtRecent[]>([]);
  const [mvtMode, setMvtMode] = useState<"entree" | "sortie" | "correction" | null>(null);

  async function loadAffaire() {
    setLoading(true);
    const { data } = await supabase
      .from("affaires")
      .select("*, charge:profiles!affaires_charge_affaires_id_fkey(nom_complet, email)")
      .eq("code_chantier", code)
      .maybeSingle();
    if (!data) {
      setAffaire(null);
      setLoading(false);
      return;
    }
    setAffaire(data as unknown as Affaire);
    setNotes((data as { notes: string | null }).notes ?? "");
    setLoading(false);
  }

  async function loadAcces(id: string) {
    const { data } = await supabase
      .from("affaire_acces")
      .select("*")
      .eq("affaire_id", id)
      .order("created_at", { ascending: false });
    setAccesList((data as Acces[]) ?? []);
  }

  useEffect(() => {
    if (ready) void loadAffaire();
  }, [ready, code]);

  useEffect(() => {
    if (affaire?.id) void loadAcces(affaire.id);
  }, [affaire?.id]);

  async function loadStock(id: string) {
    const { data: cons } = await supabase
      .from("consommation_par_affaire")
      .select("panneau_id, matiere_id, qte_entree, qte_sortie, reliquat, surface_m2_totale, valeur_consommee_ht")
      .eq("affaire_id", id);
    const lignes = (cons ?? []) as Omit<StockLigne, "panneau">[];
    const panneauIds = lignes.map((l) => l.panneau_id).filter((x): x is string => !!x);
    if (panneauIds.length === 0) {
      setStockLignes([]);
      return;
    }
    const { data: pan } = await supabase
      .from("panneaux")
      .select("id, longueur_mm, largeur_mm, cump_ht, matiere:matieres!panneaux_matiere_id_fkey(code, libelle, unite_stock)")
      .in("id", panneauIds);
    const panMap = new Map(((pan ?? []) as { id: string; longueur_mm: number; largeur_mm: number; cump_ht: number | null; matiere: { code: string; libelle: string; unite_stock: string } | null }[]).map((p) => [p.id, p]));
    const merged: StockLigne[] = lignes.map((l) => ({
      ...l,
      panneau: l.panneau_id ? panMap.get(l.panneau_id) ?? null : null,
    }));
    setStockLignes(merged);
  }

  async function loadMvtRecent(id: string) {
    const { data } = await supabase
      .from("mouvements_stock")
      .select(`
        id, created_at, type, quantite, valeur_ligne_ht, commentaire,
        panneau:panneaux!mouvements_stock_panneau_id_fkey(
          longueur_mm, largeur_mm,
          matiere:matieres!panneaux_matiere_id_fkey(code, libelle)
        )
      `)
      .eq("affaire_id", id)
      .order("created_at", { ascending: false })
      .limit(10);
    setMvtRecent(((data ?? []) as unknown) as MvtRecent[]);
  }

  useEffect(() => {
    if (affaire?.id) {
      void loadStock(affaire.id);
      void loadMvtRecent(affaire.id);
    }
  }, [affaire?.id]);

  function onNotesChange(v: string) {
    setNotes(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      if (!affaire) return;
      const { error } = await supabase.from("affaires").update({ notes: v }).eq("id", affaire.id);
      if (error) toast.error("Sauvegarde notes impossible");
    }, 1000);
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(buildInvitationLink(token));
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  }

  async function extendAcces(a: Acces) {
    const newDate = new Date(a.expire_le);
    newDate.setDate(newDate.getDate() + 30);
    const { error } = await supabase.from("affaire_acces").update({ expire_le: newDate.toISOString() }).eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Expiration prolongée de 30 jours");
      if (affaire) void loadAcces(affaire.id);
    }
  }

  async function revokeAcces(a: Acces) {
    const { error } = await supabase.from("affaire_acces").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Accès révoqué");
      if (affaire) void loadAcces(affaire.id);
    }
  }

  async function archiverAffaire() {
    if (!affaire) return;
    const { error } = await supabase.from("affaires").update({ statut: "archive" }).eq("id", affaire.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Affaire archivée");
      void loadAffaire();
    }
  }

  async function dupliquerAffaire() {
    if (!affaire) return;
    // Suggère un nouveau code_chantier basé sur le max numéro + 1
    const { data: rows } = await supabase.from("affaires").select("numero");
    const nums = ((rows ?? []) as { numero: string | null }[])
      .map((r) => r.numero)
      .filter((n): n is string => !!n)
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    const newCode = `${nextNum}_${affaire.nom} (copie)`.slice(0, 100);
    const { data, error } = await supabase.from("affaires").insert({
      code_chantier: newCode,
      nom: `${affaire.nom} (copie)`,
      client: affaire.client,
      adresse: affaire.adresse,
      charge_affaires_id: affaire.charge_affaires_id,
      charge_affaires_libre: affaire.charge_affaires_libre,
      code_interne: affaire.code_interne,
      statut: "devis",
      budget_panneaux_ht: affaire.budget_panneaux_ht,
      notes: affaire.notes,
    }).select().single();
    if (error) toast.error(error.message);
    else if (data) {
      toast.success("Affaire dupliquée");
      navigate({ to: "/affaires/$code", params: { code: (data as { code_chantier: string }).code_chantier } });
    }
  }

  async function deleteAffaire() {
    if (!affaire) return;
    const { count } = await supabase
      .from("mouvements_stock")
      .select("id", { count: "exact", head: true })
      .eq("affaire_id", affaire.id);
    if (count && count > 0) {
      toast.error("Impossible : des mouvements existent sur cette affaire");
      return;
    }
    const { error } = await supabase.from("affaires").delete().eq("id", affaire.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Affaire supprimée");
      navigate({ to: "/affaires" });
    }
  }

  const valeurConsommee = useMemo(
    () => stockLignes.reduce((acc, l) => acc + Number(l.valeur_consommee_ht ?? 0), 0),
    [stockLignes],
  );
  const reliquat = useMemo(() => {
    if (!affaire?.budget_panneaux_ht) return null;
    return Number(affaire.budget_panneaux_ht) - valeurConsommee;
  }, [affaire, valeurConsommee]);

  if (!ready || loading) return <AdminLoader />;
  if (!affaire) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">Affaire introuvable.</p>
        <Button asChild variant="outline"><Link to="/affaires">Retour à la liste</Link></Button>
      </Card>
    );
  }

  return (
    <div>
      {/* Entête figée */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-3 font-mono">{affaire.code_chantier}{affaire.code_interne ? ` · ${affaire.code_interne}` : ""}</p>
          <h1 className="text-3xl md:text-4xl truncate">{affaire.nom}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {affaire.client}
            {" • "}
            {affaire.charge?.nom_complet ?? affaire.charge?.email ?? affaire.charge_affaires_libre ?? "Sans chargé d'affaires"}
            {affaire.charge_affaires_libre && !affaire.charge_affaires_id && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-700">⚠ non matché</span>
            )}
            {" • "}
            {formatDateFr(affaire.date_debut)} → {formatDateFr(affaire.date_fin_prevue)}
          </p>
          {affaire.adresse && (
            <p className="mt-1 text-xs text-muted-foreground">{affaire.adresse}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatutBadge value={affaire.statut} />
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" /> Éditer
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={archiverAffaire}>
                <Archive className="h-4 w-4 mr-2" /> Archiver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={dupliquerAffaire}>
                <Copy className="h-4 w-4 mr-2" /> Dupliquer
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette affaire ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Action irréversible. Bloquée si des mouvements existent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAffaire}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="apercu">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto w-full justify-start gap-6">
          {[
            { v: "apercu", l: "Aperçu" },
            { v: "stock", l: "Stock alloué" },
            { v: "bdc", l: "BDC" },
            { v: "acces", l: "Accès tiers" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-none bg-transparent px-0 pb-3 pt-0 text-foreground/70 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Onglet Aperçu */}
        <TabsContent value="apercu" className="mt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6">
              <p className="eyebrow mb-2">Budget panneaux HT</p>
              <p className="text-2xl font-semibold">{formatEuro(affaire.budget_panneaux_ht)}</p>
            </Card>
            <Card className="p-6">
              <p className="eyebrow mb-2">Valeur consommée</p>
              <p className="text-2xl font-semibold">{formatEuro(valeurConsommee)}</p>
              <p className="text-xs text-muted-foreground mt-1">Sorties valorisées au CUMP</p>
            </Card>
            <Card className="p-6">
              <p className="eyebrow mb-2">Reliquat budget</p>
              <p className="text-2xl font-semibold">{reliquat !== null ? formatEuro(reliquat) : "—"}</p>
            </Card>
          </div>

          <Card className="p-6">
            <p className="eyebrow mb-3">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={5}
              placeholder="Notes internes (sauvegarde automatique)…"
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">Activité récente</p>
              <Link to="/mouvements" className="link-arrow text-xs">Voir tous →</Link>
            </div>
            {mvtRecent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement sur cette affaire.</p>
            ) : (
              <ul className="divide-y divide-border">
                {mvtRecent.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex items-center gap-3">
                      <TypeMouvementBadge value={m.type} />
                      <span className="truncate">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted mr-1.5">{m.panneau?.matiere?.code}</span>
                        <span className="text-muted-foreground">{m.panneau?.matiere?.libelle} · {m.panneau?.longueur_mm}×{m.panneau?.largeur_mm}</span>
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={Number(m.quantite) < 0 ? "text-rose-700 font-medium" : "text-emerald-700 font-medium"}>
                        {Number(m.quantite) > 0 ? "+" : ""}{formatNumber(Number(m.quantite), 2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDateTimeFr(m.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* Onglet Stock alloué */}
        <TabsContent value="stock" className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{stockLignes.length} référence(s) mouvementée(s)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMvtMode("entree")}>
                <ArrowDownToLine className="h-4 w-4" /> Entrée
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMvtMode("sortie")}>
                <ArrowUpFromLine className="h-4 w-4" /> Sortie
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMvtMode("correction")}>
                <Wrench className="h-4 w-4" /> Correction
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead className="text-right">Qté entrée</TableHead>
                  <TableHead className="text-right">Qté sortie</TableHead>
                  <TableHead className="text-right">Reliquat</TableHead>
                  <TableHead className="text-right">CUMP courant</TableHead>
                  <TableHead className="text-right">Valeur consommée HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLignes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun panneau mouvementé sur cette affaire</TableCell></TableRow>
                ) : (
                  stockLignes.map((l, idx) => (
                    <TableRow key={l.panneau_id ?? idx} className={idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}>
                      <TableCell>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted mr-2">{l.panneau?.matiere?.code ?? "—"}</span>
                        <span className="text-muted-foreground">{l.panneau?.matiere?.libelle ?? "—"}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {l.panneau ? `${l.panneau.longueur_mm}×${l.panneau.largeur_mm}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-emerald-700">{formatNumber(Number(l.qte_entree ?? 0), 2)}</TableCell>
                      <TableCell className="text-right text-rose-700">{formatNumber(Number(l.qte_sortie ?? 0), 2)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(Number(l.reliquat ?? 0), 2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.panneau?.cump_ht !== null && l.panneau?.cump_ht !== undefined ? formatEuro(Number(l.panneau.cump_ht)) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatEuro(Number(l.valeur_consommee_ht ?? 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Onglet BDC */}
        <TabsContent value="bdc" className="mt-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Aucun bon de commande rattaché.</p>
              <Button variant="outline" disabled title="Disponible passe 5 — BDC + OCR">
                <Plus className="h-4 w-4" /> Rattacher un BDC
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Onglet Accès tiers */}
        <TabsContent value="acces" className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{accesList.length} invitation(s)</p>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Inviter un tiers
            </Button>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accesList.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune invitation</TableCell></TableRow>
                ) : (
                  accesList.map((a, idx) => {
                    const actif = new Date(a.expire_le).getTime() > Date.now();
                    return (
                      <TableRow key={a.id} className={idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}>
                        <TableCell className="font-medium">{a.email_invite}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" style={{ color: "#2F5BFF", backgroundColor: "rgba(47,91,255,0.10)" }}>
                            {permissionLabel(a.permissions)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateFr(a.expire_le)}</TableCell>
                        <TableCell>
                          {actif ? (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" style={{ color: "#166534", backgroundColor: "rgba(22,101,52,0.10)" }}>Actif</span>
                          ) : (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" style={{ color: "#6B7280", backgroundColor: "rgba(107,114,128,0.10)" }}>Expiré</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => copyLink(a.token)} title="Copier le lien">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => extendAcces(a)} title="Prolonger +30j">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Révoquer"><Ban className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Révoquer cet accès ?</AlertDialogTitle>
                                  <AlertDialogDescription>Le lien magique cessera immédiatement de fonctionner.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => revokeAcces(a)}>Révoquer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <AffaireFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={affaire}
        onSaved={(a) => {
          if (a.code_chantier !== affaire.code_chantier) {
            navigate({ to: "/affaires/$code", params: { code: a.code_chantier } });
          } else {
            void loadAffaire();
          }
        }}
      />
      <InviteTiersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        affaireId={affaire.id}
        onCreated={() => void loadAcces(affaire.id)}
      />
      <MouvementDialog
        open={mvtMode !== null}
        onOpenChange={(v) => { if (!v) setMvtMode(null); }}
        mode={mvtMode ?? "sortie"}
        presetAffaireId={affaire.id}
        isAdmin={profile?.role === "admin"}
        userId={user?.id ?? null}
        onCreated={() => {
          if (affaire) {
            void loadStock(affaire.id);
            void loadMvtRecent(affaire.id);
          }
        }}
      />
    </div>
  );
}
