import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
import { useBdcDetail } from "@/hooks/useBdcDetail";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, RefreshCw, X, AlertTriangle, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
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
import { BdcHeaderCard } from "@/components/bdc/BdcHeaderCard";
import { BdcLignesTable } from "@/components/bdc/BdcLignesTable";

export const Route = createFileRoute("/_app/bdc/$id")({
  head: () => ({ meta: [{ title: "Validation BDC — Setup Stock" }] }),
  component: BdcDetailPage,
});

function BdcDetailPage() {
  const { id } = Route.useParams();
  const { ready } = useAdminGuard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const {
    bdc,
    setBdc,
    lignes,
    panneaux,
    fournisseurs,
    affaires,
    pdfUrl,
    loading,
    reocrLoading,
    validating,
    confidenceByLigne,
    totalCalcule,
    ecartTotal,
    updateLigne,
    addLigneVide,
    handleHeaderUpdate,
    handleSaveLigne,
    deleteLigneInDb,
    handleRelaunchOcr,
    switchToManual,
    handleValider,
    handleAnnuler,
  } = useBdcDetail(id, ready, user?.id);

  // Détection du mode et des erreurs OCR à partir de extraction_brute_json
  const { isManualMode, ocrError } = useMemo(() => {
    const raw = (bdc?.extraction_brute_json as Record<string, unknown> | null) ?? null;
    if (!raw) return { isManualMode: false, ocrError: null as string | null };
    const manual = raw.saisie_manuelle === true || raw.mode === "manuel";
    const errVal = raw.error;
    let errMsg: string | null = null;
    if (typeof errVal === "string") errMsg = errVal;
    else if (errVal && typeof errVal === "object" && "message" in errVal) {
      const m = (errVal as { message?: unknown }).message;
      if (typeof m === "string") errMsg = m;
    }
    return { isManualMode: manual, ocrError: errMsg };
  }, [bdc]);

  if (!ready || loading) return <AdminLoader />;
  if (!bdc) return <div className="p-12 text-center text-muted-foreground">BDC introuvable</div>;

  const isReadOnly = bdc.statut === "valide" || bdc.statut === "recu" || bdc.statut === "annule";
  const goBack = () => navigate({ to: "/bdc" });
  const showPdfPanel = !isManualMode || !!bdc.fichier_pdf_url;

  return (
    <div>
      <PageHeader
        eyebrow={isManualMode ? "Bon de commande · saisie manuelle" : "Bon de commande"}
        title={bdc.numero_bdc ?? "Sans numéro"}
        description={`Statut : ${bdc.statut}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/bdc">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        }
      />

      {bdc.statut === "en_attente_ocr" && !ocrError && (
        <Card className="p-6 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-foreground">OCR en cours…</p>
              <p className="text-sm text-muted-foreground">
                L'analyse Mindee prend 10 à 30 secondes. Cette page se met à jour automatiquement.
              </p>
            </div>
          </div>
        </Card>
      )}

      {ocrError && !isReadOnly && (
        <Card className="p-5 mb-6 border-warning bg-warning/5">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-medium text-foreground">L'extraction OCR a échoué</p>
                <p className="text-sm text-muted-foreground mt-1">{ocrError}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Vous pouvez relancer l'OCR ou passer en saisie manuelle pour ajouter les lignes
                  vous-même.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRelaunchOcr}
                  disabled={reocrLoading}
                >
                  {reocrLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Relancer l'OCR
                </Button>
                <Button size="sm" onClick={switchToManual}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Passer en saisie manuelle
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className={showPdfPanel ? "grid grid-cols-1 lg:grid-cols-5 gap-6" : ""}>
        {showPdfPanel && (
          <Card className="lg:col-span-2 p-0 overflow-hidden h-[80vh]">
            {pdfUrl ? (
              <iframe src={pdfUrl} title="PDF BDC" className="w-full h-full border-0" />
            ) : (
              <div className="h-full grid place-content-center text-muted-foreground text-sm px-4 text-center">
                {isManualMode ? "Saisie manuelle — pas de PDF" : "PDF indisponible"}
              </div>
            )}
          </Card>
        )}

        <div className={showPdfPanel ? "lg:col-span-3 space-y-6" : "space-y-6"}>
          <BdcHeaderCard
            bdc={bdc}
            setBdc={setBdc}
            fournisseurs={fournisseurs}
            affaires={affaires}
            isReadOnly={isReadOnly}
            onUpdate={handleHeaderUpdate}
          />

          <BdcLignesTable
            lignes={lignes}
            panneaux={panneaux}
            confidenceByLigne={confidenceByLigne}
            isReadOnly={isReadOnly}
            totalCalcule={totalCalcule}
            montantHtTotal={bdc.montant_ht_total}
            ecartTotal={ecartTotal}
            onAddLigne={addLigneVide}
            onUpdateLigne={updateLigne}
            onSaveLigne={handleSaveLigne}
            onDeleteLigne={deleteLigneInDb}
          />

          {!isReadOnly && (
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              {!isManualMode && (
                <Button variant="outline" onClick={handleRelaunchOcr} disabled={reocrLoading}>
                  {reocrLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Relancer l'OCR
                </Button>
              )}
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                <X className="h-4 w-4 mr-2" /> Annuler le BDC
              </Button>
              <Button onClick={() => handleValider(goBack)} disabled={validating}>
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
              Le statut passera à « Annulé » et aucune entrée de stock ne sera créée. Action
              réversible manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAnnuler(goBack)}>
              Annuler le BDC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
