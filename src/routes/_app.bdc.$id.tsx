import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, RefreshCw, X, Trash2, Check as CheckIcon, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { StatutBdcBadge } from "@/components/StatutBdcBadge";
import { confidenceMeta } from "@/lib/bdc";
import { formatEuro } from "@/lib/familles";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { ocrBdc } from "@/lib/bdc-ocr.functions";

export const Route = createFileRoute("/_app/bdc/$id")({
  head: () => ({ meta: [{ title: "Validation BDC — Setup Stock" }] }),
  component: BdcDetailPage,
});

type BdcDetail = {
  id: string;
  numero_bdc: string | null;
  date_bdc: string | null;
  statut: string;
  montant_ht_total: number | null;
  fichier_pdf_url: string | null;
  affaire_id: string | null;
  fournisseur_id: string;
  validated_at: string | null;
  extraction_brute_json: unknown;
};

type LigneRow = {
  id: string;
  bdc_id: string;
  panneau_id: string | null;
  matiere_libelle_brut: string | null;
  dimensions_brut: string | null;
  quantite: number;
  prix_unitaire_ht: number;
  ligne_validee: boolean;
};

type PanneauOption = {
  id: string;
  matiere_code: string | null;
  matiere_libelle: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
  cump_ht: number | null;
};

type Fournisseur = { id: string; nom: string };
type Affaire = { id: string; code_chantier: string; nom: string };

function BdcDetailPage() {
  const { id } = Route.useParams();
  const { ready } = useAdminGuard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ocrFn = useServerFn(ocrBdc);

  const [bdc, setBdc] = useState<BdcDetail | null>(null);
  const [lignes, setLignes] = useState<LigneRow[]>([]);
  const [panneaux, setPanneaux] = useState<PanneauOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reocrLoading, setReocrLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confidenceByLigne, setConfidenceByLigne] = useState<Record<number, number | null>>({});

  async function load() {
    setLoading(true);
    const [bRes, lRes, pRes, fRes, aRes] = await Promise.all([
      supabase.from("bons_de_commande").select("*").eq("id", id).maybeSingle(),
      supabase.from("bdc_lignes").select("*").eq("bdc_id", id).order("id"),
      supabase.from("catalogue_visible").select("id, matiere_code, matiere_libelle, longueur_mm, largeur_mm, cump_ht"),
      supabase.from("fournisseurs").select("id, nom").order("nom"),
      supabase.from("affaires").select("id, code_chantier, nom").order("code_chantier"),
    ]);
    setBdc(bRes.data as BdcDetail);
    setLignes((lRes.data as LigneRow[]) ?? []);
    setPanneaux((pRes.data as PanneauOption[]) ?? []);
    setFournisseurs((fRes.data as Fournisseur[]) ?? []);
    setAffaires((aRes.data as Affaire[]) ?? []);

    if (bRes.data?.fichier_pdf_url) {
      const { data: signed } = await supabase.storage
        .from("bdc-uploads")
        .createSignedUrl(bRes.data.fichier_pdf_url, 3600);
      setPdfUrl(signed?.signedUrl ?? null);
    }

    // Extract confidences from extraction_brute_json
    const raw = bRes.data?.extraction_brute_json as
      | { document?: { inference?: { prediction?: { line_items?: { confidence?: number | null }[] } } } }
      | null;
    const items = raw?.document?.inference?.prediction?.line_items;
    if (Array.isArray(items)) {
      const map: Record<number, number | null> = {};
      items.forEach((it, i) => { map[i] = it?.confidence ?? null; });
      setConfidenceByLigne(map);
    }

    setLoading(false);
  }

  useEffect(() => { if (ready) load(); }, [ready, id]);

  // Realtime: when statut switches to ocr_termine, reload lignes
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`bdc-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bons_de_commande", filter: `id=eq.${id}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [ready, id]);

  function updateLigne(ligneId: string, patch: Partial<LigneRow>) {
    setLignes((prev) => prev.map((l) => (l.id === ligneId ? { ...l, ...patch } : l)));
  }

  function removeLigne(ligneId: string) {
    setLignes((prev) => prev.filter((l) => l.id !== ligneId));
  }

  async function addLigneVide() {
    const { data, error } = await supabase
      .from("bdc_lignes")
      .insert({
        bdc_id: id,
        matiere_libelle_brut: null,
        quantite: 1,
        prix_unitaire_ht: 0,
        ligne_validee: false,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    setLignes((prev) => [...prev, data as LigneRow]);
  }

  const totalCalcule = useMemo(
    () => lignes.filter((l) => l.ligne_validee).reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire_ht), 0),
    [lignes],
  );

  const ecartTotal = bdc?.montant_ht_total
    ? Math.abs((totalCalcule - Number(bdc.montant_ht_total)) / Number(bdc.montant_ht_total))
    : 0;

  async function handleHeaderUpdate(patch: Partial<Pick<BdcDetail, "fournisseur_id" | "numero_bdc" | "date_bdc" | "affaire_id" | "montant_ht_total">>) {
    if (!bdc) return;
    setBdc({ ...bdc, ...patch });
    const { error } = await supabase.from("bons_de_commande").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function handleSaveLigne(ligne: LigneRow) {
    const { error } = await supabase
      .from("bdc_lignes")
      .update({
        panneau_id: ligne.panneau_id,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        ligne_validee: ligne.ligne_validee,
      })
      .eq("id", ligne.id);
    if (error) toast.error(error.message);
  }

  async function deleteLigneInDb(ligneId: string) {
    const { error } = await supabase.from("bdc_lignes").delete().eq("id", ligneId);
    if (error) toast.error(error.message);
    else removeLigne(ligneId);
  }

  async function handleRelaunchOcr() {
    setReocrLoading(true);
    try {
      const result = await ocrFn({ data: { bdcId: id } });
      if (result.ok) {
        toast.success(`OCR relancé : ${result.lignes_extraites} ligne(s)`);
        await load();
      } else {
        toast.error(`OCR échoué : ${result.error}`);
      }
    } catch (e) {
      toast.error("Erreur OCR : " + (e instanceof Error ? e.message : "inconnue"));
    } finally {
      setReocrLoading(false);
    }
  }

  async function handleValider() {
    if (!bdc) return;
    const lignesAValider = lignes.filter((l) => l.ligne_validee && l.panneau_id);
    if (lignesAValider.length === 0) {
      toast.error("Cochez au moins une ligne avec un panneau associé.");
      return;
    }

    setValidating(true);

    // Sauver d'abord les édits courants des lignes validées
    for (const l of lignesAValider) {
      await supabase
        .from("bdc_lignes")
        .update({
          panneau_id: l.panneau_id,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          ligne_validee: true,
        })
        .eq("id", l.id);
    }

    // Créer les mouvements d'entrée
    let okCount = 0;
    for (const l of lignesAValider) {
      const { error } = await supabase.from("mouvements_stock").insert({
        panneau_id: l.panneau_id!,
        type: "entree",
        quantite: Number(l.quantite),
        prix_unitaire_ht: Number(l.prix_unitaire_ht),
        affaire_id: bdc.affaire_id,
        bdc_id: id,
        effectue_par: user?.id ?? null,
        commentaire: `BDC ${bdc.numero_bdc ?? ""}`.trim(),
      });
      if (error) {
        toast.error(`Ligne « ${l.matiere_libelle_brut ?? ""} » : ${error.message}`);
      } else {
        okCount += 1;
      }
    }

    if (okCount > 0) {
      await supabase
        .from("bons_de_commande")
        .update({ statut: "valide", validated_at: new Date().toISOString() })
        .eq("id", id);
      toast.success(`${okCount} entrée(s) de stock créée(s). CUMP recalculé.`);
      navigate({ to: "/bdc" });
    }

    setValidating(false);
  }

  async function handleAnnuler() {
    await supabase.from("bons_de_commande").update({ statut: "annule" }).eq("id", id);
    toast.success("BDC annulé");
    navigate({ to: "/bdc" });
  }

  if (!ready || loading) return <AdminLoader />;
  if (!bdc) return <div className="p-12 text-center text-muted-foreground">BDC introuvable</div>;

  const isReadOnly = bdc.statut === "valide" || bdc.statut === "recu" || bdc.statut === "annule";

  return (
    <div>
      <PageHeader
        eyebrow="Bon de commande"
        title={bdc.numero_bdc ?? "Sans numéro"}
        description={`Statut : ${bdc.statut}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/bdc"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
          </Button>
        }
      />

      {bdc.statut === "en_attente_ocr" && (
        <Card className="p-6 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-foreground">OCR en cours…</p>
              <p className="text-sm text-muted-foreground">L'analyse Mindee prend 10 à 30 secondes. Cette page se met à jour automatiquement.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* PDF preview */}
        <Card className="lg:col-span-2 p-0 overflow-hidden h-[80vh]">
          {pdfUrl ? (
            <iframe src={pdfUrl} title="PDF BDC" className="w-full h-full border-0" />
          ) : (
            <div className="h-full grid place-content-center text-muted-foreground text-sm">PDF indisponible</div>
          )}
        </Card>

        {/* Validation form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">En-tête</h2>
              <StatutBdcBadge value={bdc.statut} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Fournisseur</Label>
                <FournisseurPicker
                  fournisseurs={fournisseurs}
                  value={bdc.fournisseur_id}
                  disabled={isReadOnly}
                  onChange={(v) => handleHeaderUpdate({ fournisseur_id: v })}
                />
              </div>
              <div>
                <Label>N° BDC</Label>
                <Input
                  value={bdc.numero_bdc ?? ""}
                  disabled={isReadOnly}
                  onChange={(e) => setBdc({ ...bdc, numero_bdc: e.target.value })}
                  onBlur={() => handleHeaderUpdate({ numero_bdc: bdc.numero_bdc })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={bdc.date_bdc ?? ""}
                  disabled={isReadOnly}
                  onChange={(e) => setBdc({ ...bdc, date_bdc: e.target.value })}
                  onBlur={() => handleHeaderUpdate({ date_bdc: bdc.date_bdc })}
                />
              </div>
              <div>
                <Label>Affaire</Label>
                <AffairePicker
                  affaires={affaires}
                  value={bdc.affaire_id}
                  disabled={isReadOnly}
                  onChange={(v) => handleHeaderUpdate({ affaire_id: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Montant HT total annoncé (Mindee)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={bdc.montant_ht_total ?? ""}
                  disabled={isReadOnly}
                  onChange={(e) => setBdc({ ...bdc, montant_ht_total: e.target.value === "" ? null : Number(e.target.value) })}
                  onBlur={() => handleHeaderUpdate({ montant_ht_total: bdc.montant_ht_total })}
                />
              </div>
            </div>
          </Card>

          {/* Lignes */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Lignes ({lignes.length})</h2>
              {!isReadOnly && (
                <Button size="sm" variant="outline" onClick={addLigneVide}>+ Ajouter une ligne</Button>
              )}
            </div>

            {lignes.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune ligne extraite. Ajoutez-les manuellement ou relancez l'OCR.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Description OCR</th>
                      <th className="px-3 py-2 text-left font-medium">Panneau</th>
                      <th className="px-3 py-2 text-right font-medium">Qté</th>
                      <th className="px-3 py-2 text-right font-medium">PU HT</th>
                      <th className="px-3 py-2 text-right font-medium">Valeur</th>
                      <th className="px-3 py-2 text-center font-medium">Conf.</th>
                      <th className="px-3 py-2 text-center font-medium">Valider</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, idx) => {
                      const conf = confidenceByLigne[idx];
                      const cm = confidenceMeta(conf);
                      const valeur = Number(l.quantite) * Number(l.prix_unitaire_ht);
                      return (
                        <tr key={l.id} className="border-b border-border last:border-0 align-top">
                          <td className="px-3 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={l.matiere_libelle_brut ?? ""}>
                            {l.matiere_libelle_brut ?? "—"}
                          </td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <PanneauPicker
                              panneaux={panneaux}
                              value={l.panneau_id}
                              disabled={isReadOnly}
                              onChange={(v) => { updateLigne(l.id, { panneau_id: v }); void handleSaveLigne({ ...l, panneau_id: v }); }}
                            />
                          </td>
                          <td className="px-3 py-2 w-20">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-right"
                              value={l.quantite}
                              disabled={isReadOnly}
                              onChange={(e) => updateLigne(l.id, { quantite: Number(e.target.value) })}
                              onBlur={() => handleSaveLigne(l)}
                            />
                          </td>
                          <td className="px-3 py-2 w-24">
                            <Input
                              type="number"
                              step="0.0001"
                              className="h-8 text-right"
                              value={l.prix_unitaire_ht}
                              disabled={isReadOnly}
                              onChange={(e) => updateLigne(l.id, { prix_unitaire_ht: Number(e.target.value) })}
                              onBlur={() => handleSaveLigne(l)}
                            />
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs">{formatEuro(valeur)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: cm.color, backgroundColor: cm.bg }}>
                              {cm.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Checkbox
                              checked={l.ligne_validee}
                              disabled={isReadOnly || !l.panneau_id}
                              onCheckedChange={(v) => { updateLigne(l.id, { ligne_validee: !!v }); void handleSaveLigne({ ...l, ligne_validee: !!v }); }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!isReadOnly && (
                              <Button variant="ghost" size="sm" onClick={() => deleteLigneInDb(l.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={4} className="px-3 py-3 text-right text-xs text-muted-foreground">Total des lignes cochées</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatEuro(totalCalcule)}</td>
                      <td colSpan={3} className="px-3 py-3">
                        {bdc.montant_ht_total !== null && totalCalcule > 0 && (
                          ecartTotal > 0.05 ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              Écart {(ecartTotal * 100).toFixed(1)}%
                            </span>
                          ) : ecartTotal > 0.01 ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-warning/15 text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              Écart {(ecartTotal * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
                              <CheckIcon className="h-3 w-3" /> OK
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={handleRelaunchOcr} disabled={reocrLoading}>
                {reocrLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Relancer l'OCR
              </Button>
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                <X className="h-4 w-4 mr-2" /> Annuler le BDC
              </Button>
              <Button onClick={handleValider} disabled={validating}>
                {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Valider et créer les entrées
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce BDC ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le statut passera à « Annulé » et aucune entrée de stock ne sera créée. Action réversible manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnnuler}>Annuler le BDC</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Pickers ---

function FournisseurPicker({
  fournisseurs, value, disabled, onChange,
}: { fournisseurs: Fournisseur[]; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const sel = fournisseurs.find((f) => f.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={cn("truncate", !sel && "text-muted-foreground")}>{sel?.nom ?? "—"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher…" />
          <CommandList>
            <CommandEmpty>Aucun</CommandEmpty>
            <CommandGroup>
              {fournisseurs.map((f) => (
                <CommandItem key={f.id} value={f.nom} onSelect={() => { onChange(f.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === f.id ? "opacity-100" : "opacity-0")} />
                  {f.nom}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AffairePicker({
  affaires, value, disabled, onChange,
}: { affaires: Affaire[]; value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const sel = affaires.find((a) => a.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={cn("truncate", !sel && "text-muted-foreground")}>
            {sel ? <><span className="font-mono text-xs mr-2">{sel.code_chantier}</span>{sel.nom}</> : "— Aucune"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Code chantier ou nom…" />
          <CommandList>
            <CommandEmpty>Aucune</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">— Aucune</span>
              </CommandItem>
              {affaires.map((a) => (
                <CommandItem key={a.id} value={`${a.code_chantier} ${a.nom}`} onSelect={() => { onChange(a.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs mr-2">{a.code_chantier}</span>
                  <span className="truncate">{a.nom}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PanneauPicker({
  panneaux, value, disabled, onChange,
}: { panneaux: PanneauOption[]; value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const sel = panneaux.find((p) => p.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full h-8 justify-between font-normal text-xs" disabled={disabled}>
          <span className={cn("truncate", !sel && "text-muted-foreground")}>
            {sel ? (
              <>
                <span className="font-mono mr-1">{sel.matiere_code}</span>
                <span>{sel.matiere_libelle}</span>
                <span className="text-muted-foreground ml-1">({sel.longueur_mm}×{sel.largeur_mm})</span>
              </>
            ) : "— À sélectionner"}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher matière, dimensions…" />
          <CommandList>
            <CommandEmpty>Aucun panneau</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">— Aucun</span>
              </CommandItem>
              {panneaux.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.matiere_code} ${p.matiere_libelle} ${p.longueur_mm}x${p.largeur_mm}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs mr-2">{p.matiere_code}</span>
                  <span className="flex-1 truncate">{p.matiere_libelle}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.longueur_mm}×{p.largeur_mm}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
