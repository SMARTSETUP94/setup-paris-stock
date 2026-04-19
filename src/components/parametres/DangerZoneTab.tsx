/**
 * Onglet "Danger zone" des paramètres admin.
 *
 * Action : remise à zéro de toutes les données métier (mouvements, BDC, affaires)
 * tout en conservant le catalogue (matières, panneaux, fournisseurs) et les
 * utilisateurs.
 *
 * Garde-fous :
 *   1. Export CSV automatique de la table mouvements_stock avant la purge.
 *   2. Double confirmation : taper "RESET" dans le champ + bouton rouge.
 *   3. Vérif admin côté serveur (server fn + fonction SQL).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { exportRawMouvements, resetDonneesMetier } from "@/lib/admin-reset.functions";

type RawRow = Record<string, unknown>;

function flattenRow(row: RawRow): Record<string, string | number | null> {
  const panneau = (row.panneaux ?? null) as RawRow | null;
  const matiere = (panneau?.matieres ?? null) as RawRow | null;
  const affaire = (row.affaires ?? null) as RawRow | null;
  return {
    id: (row.id as string) ?? "",
    created_at: (row.created_at as string) ?? "",
    type: (row.type as string) ?? "",
    quantite: (row.quantite as number) ?? 0,
    prix_unitaire_ht: (row.prix_unitaire_ht as number | null) ?? null,
    cump_avant: (row.cump_avant as number | null) ?? null,
    cump_apres: (row.cump_apres as number | null) ?? null,
    valeur_ligne_ht: (row.valeur_ligne_ht as number | null) ?? null,
    matiere_code: (matiere?.code as string) ?? "",
    matiere_libelle: (matiere?.libelle as string) ?? "",
    longueur_mm: (panneau?.longueur_mm as number | null) ?? null,
    largeur_mm: (panneau?.largeur_mm as number | null) ?? null,
    epaisseur_mm: (panneau?.epaisseur_mm as number | null) ?? null,
    reference_fournisseur: (panneau?.reference_fournisseur as string) ?? "",
    affaire_code: (affaire?.code_chantier as string) ?? "",
    affaire_nom: (affaire?.nom as string) ?? "",
    panneau_id: (row.panneau_id as string) ?? "",
    affaire_id: (row.affaire_id as string | null) ?? "",
    bdc_id: (row.bdc_id as string | null) ?? "",
    effectue_par: (row.effectue_par as string | null) ?? "",
    commentaire: (row.commentaire as string | null) ?? "",
    photo_url: (row.photo_url as string | null) ?? "",
  };
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(
      headers.map((h) => csvEscape(r[h] as string | number | null | undefined)).join(";"),
    );
  }
  // BOM UTF-8 pour Excel
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DangerZoneTab() {
  const exportFn = useServerFn(exportRawMouvements);
  const resetFn = useServerFn(resetDonneesMetier);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"idle" | "exporting" | "resetting">("idle");

  async function handleConfirmReset() {
    if (confirm !== "RESET") {
      toast.error("Tape exactement RESET pour confirmer");
      return;
    }

    // 1. Export CSV de sauvegarde
    setStep("exporting");
    let rowsCount = 0;
    try {
      const res = await exportFn();
      const rows = res.rows.map(flattenRow);
      rowsCount = rows.length;
      const headers =
        rows.length > 0
          ? Object.keys(rows[0])
          : [
              "id",
              "created_at",
              "type",
              "quantite",
              "prix_unitaire_ht",
              "matiere_code",
              "affaire_code",
            ];
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadCsv(`backup-mouvements-${stamp}.csv`, headers, rows);
      toast.success(`Sauvegarde CSV téléchargée (${rowsCount} mouvements)`);
    } catch (e) {
      setStep("idle");
      toast.error("Sauvegarde impossible — reset annulé", {
        description: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    // 2. Reset
    setStep("resetting");
    try {
      const result = await resetFn();
      toast.success("Données métier remises à zéro", {
        description: `${result.mouvements_supprimes} mouvements et ${result.bdc_supprimes} BDC supprimés. Affaires conservées.`,
      });
      setOpen(false);
      setConfirm("");
    } catch (e) {
      toast.error("Reset impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start gap-3 bg-destructive/10 border-destructive/30">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Zone dangereuse</p>
          <p className="text-muted-foreground">
            Ces actions sont irréversibles. Réservées aux administrateurs.
          </p>
        </div>
      </Card>

      <Card className="p-5 border-destructive/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <h3 className="text-base font-semibold text-foreground">
              Remettre à zéro les mouvements
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Supprime <strong>tous les mouvements de stock</strong> et les <strong>bons de commande</strong>{" "}
              (en-têtes + lignes). Le CUMP de chaque panneau est remis à zéro.
            </p>
            <ul className="text-xs text-muted-foreground mt-2 list-disc pl-5 space-y-0.5">
              <li>
                Conservés : <strong>affaires</strong>, matières, panneaux, fournisseurs, typologies, utilisateurs et branding.
              </li>
              <li>Une sauvegarde CSV des mouvements est téléchargée automatiquement avant.</li>
              <li>Action impossible à annuler côté application.</li>
            </ul>
          </div>
          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            disabled={busy}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remettre à zéro
          </Button>
        </div>
      </Card>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) {
            setOpen(o);
            if (!o) setConfirm("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmer la remise à zéro
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Cette action va supprimer <strong>toutes les affaires</strong>, <strong>tous les
                  bons de commande</strong> et <strong>tous les mouvements de stock</strong>. Elle
                  est <strong>définitive</strong>.
                </p>
                <p className="text-muted-foreground">
                  Une sauvegarde CSV des mouvements sera téléchargée juste avant la suppression.
                </p>
                <div className="rounded-md bg-muted/40 border border-border p-2 text-xs flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  Fichier : <span className="font-mono">backup-mouvements-…csv</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="confirm-reset" className="text-foreground">
                    Pour confirmer, tape <span className="font-mono font-bold">RESET</span> :
                  </Label>
                  <Input
                    id="confirm-reset"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="RESET"
                    autoComplete="off"
                    disabled={busy}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmReset();
              }}
              disabled={busy || confirm !== "RESET"}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {step === "exporting"
                ? "Sauvegarde…"
                : step === "resetting"
                  ? "Suppression…"
                  : "Sauvegarder puis effacer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
