import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Edit, MoreHorizontal, Plus, Trash2, Archive, RefreshCw, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
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
import { formatDateFr, permissionLabel, buildInvitationLink } from "@/lib/affaires";
import { formatEuro } from "@/lib/familles";
import type { Database } from "@/integrations/supabase/types";

type Affaire = Database["public"]["Tables"]["affaires"]["Row"] & {
  responsable?: { nom_complet: string | null; email: string } | null;
  client?: { nom: string; actif: boolean } | null;
};
type Acces = Database["public"]["Tables"]["affaire_acces"]["Row"];

export const Route = createFileRoute("/_app/affaires/$numero")({
  head: () => ({ meta: [{ title: "Affaire — Setup Stock" }] }),
  component: AffaireDetail,
});

function AffaireDetail() {
  const { numero } = Route.useParams();
  const navigate = useNavigate();
  const { ready } = useAdminGuard();
  const [affaire, setAffaire] = useState<Affaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [accesList, setAccesList] = useState<Acces[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadAffaire() {
    setLoading(true);
    const { data } = await supabase
      .from("affaires")
      .select("*, responsable:profiles!affaires_responsable_id_fkey(nom_complet, email), client:clients!affaires_client_id_fkey(nom, actif)")
      .eq("numero", numero)
      .maybeSingle();
    if (!data) {
      setAffaire(null);
      setLoading(false);
      return;
    }
    setAffaire(data as Affaire);
    setNotes((data as Affaire).notes ?? "");
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
  }, [ready, numero]);

  useEffect(() => {
    if (affaire?.id) void loadAcces(affaire.id);
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
    // Trouve le prochain numéro 4 chiffres disponible
    const { data: rows } = await supabase.from("affaires").select("numero");
    const nums = ((rows ?? []) as { numero: string }[])
      .map((r) => r.numero)
      .filter((n) => /^\d{4}$/.test(n))
      .map((n) => parseInt(n, 10));
    const nextNum = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0");
    const { data, error } = await supabase.from("affaires").insert({
      numero: nextNum,
      nom: `${affaire.nom} (copie)`,
      client_id: affaire.client_id,
      statut: "devis",
      responsable_id: affaire.responsable_id,
      budget_panneaux_ht: affaire.budget_panneaux_ht,
      notes: affaire.notes,
    }).select().single();
    if (error) toast.error(error.message);
    else if (data) {
      toast.success("Affaire dupliquée");
      navigate({ to: "/affaires/$numero", params: { numero: (data as Affaire).numero } });
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

  const reliquat = useMemo(() => {
    if (!affaire?.budget_panneaux_ht) return null;
    return affaire.budget_panneaux_ht; // placeholder — passe 4 fournira la consommation réelle
  }, [affaire]);

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
          <p className="eyebrow mb-3">Affaire n° {affaire.numero}</p>
          <h1 className="text-3xl md:text-4xl truncate">{affaire.nom}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {affaire.client?.nom ?? "Client non renseigné"}
            {" • "}
            {affaire.responsable?.nom_complet ?? affaire.responsable?.email ?? "Sans responsable"}
            {" • "}
            {formatDateFr(affaire.date_debut)} → {formatDateFr(affaire.date_fin_prevue)}
          </p>
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
              <p className="text-2xl font-semibold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">Disponible passe Mouvements</p>
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
            <p className="eyebrow mb-3">Activité récente</p>
            <p className="text-sm text-muted-foreground">
              Les activités apparaîtront ici une fois la passe Mouvements livrée.
            </p>
          </Card>
        </TabsContent>

        {/* Onglet Stock alloué */}
        <TabsContent value="stock" className="mt-8">
          <Card className="p-12 text-center text-sm text-muted-foreground">
            Les panneaux mouvementés sur cette affaire apparaîtront ici dès que la passe Mouvements sera livrée.
            <br />Colonnes prévues : Référence panneau, Quantité entrée, Quantité sortie, Reliquat, Valeur consommée au CUMP.
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
          if (a.numero !== affaire.numero) {
            navigate({ to: "/affaires/$numero", params: { numero: a.numero } });
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
    </div>
  );
}
