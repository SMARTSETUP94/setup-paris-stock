/**
 * ============================================================
 * ROUTE PUBLIQUE — /scan/$panneauId
 * ============================================================
 * Page de déclaration de sortie SANS AUTHENTIFICATION.
 * Accessible uniquement après avoir scanné un QR physique en atelier
 * (ou via la recherche texte fallback sur /scan).
 * Mitigations : voir src/lib/scan.functions.ts (entête).
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPanneauPublic,
  listAffairesActivesPublic,
  declarerSortieScan,
} from "@/lib/scan.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ScanLine, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/scan/$panneauId")({
  head: () => ({
    meta: [{ title: "Sortie panneau — Setup Stock" }, { name: "robots", content: "noindex" }],
  }),
  component: ScanSortiePage,
});

type Panneau = Awaited<ReturnType<typeof getPanneauPublic>>;
type Affaire = Awaited<ReturnType<typeof listAffairesActivesPublic>>[number];

function ScanSortiePage() {
  const { panneauId } = Route.useParams();
  const navigate = useNavigate();
  const getPanneauFn = useServerFn(getPanneauPublic);
  const listAffairesFn = useServerFn(listAffairesActivesPublic);
  const declarerFn = useServerFn(declarerSortieScan);

  const [panneau, setPanneau] = useState<Panneau | null>(null);
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [affaireId, setAffaireId] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [nom, setNom] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ affaire: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [p, a] = await Promise.all([getPanneauFn({ data: { panneauId } }), listAffairesFn()]);
        if (!mounted) return;
        setPanneau(p);
        setAffaires(a);
        // Pré-remplir le nom depuis le localStorage si déjà saisi
        const savedNom = localStorage.getItem("setup-scan-nom");
        if (savedNom) setNom(savedNom);
        // Pré-remplir l'affaire avec la dernière utilisée si elle est encore active
        const lastAffaire = localStorage.getItem("setup-scan-last-affaire");
        if (lastAffaire && a.some((x) => x.id === lastAffaire)) {
          setAffaireId(lastAffaire);
        }
      } catch (e) {
        setLoadError((e instanceof Error ? e.message : null) ?? "Erreur de chargement");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [panneauId, getPanneauFn, listAffairesFn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const qte = Number(quantite.replace(",", "."));
    if (!affaireId) return toast.error("Choisis une affaire");
    if (!nom.trim()) return toast.error("Indique ton nom");
    if (!Number.isFinite(qte) || qte <= 0) return toast.error("Quantité invalide");
    if (panneau && qte > (panneau.stock_actuel ?? 0)) {
      const ok = window.confirm(
        `Stock actuel : ${panneau.stock_actuel}. Tu veux sortir ${qte} ? Cela passera le stock en négatif.`,
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      localStorage.setItem("setup-scan-nom", nom.trim());
      localStorage.setItem("setup-scan-last-affaire", affaireId);
      const res = await declarerFn({
        data: {
          panneauId,
          affaireId,
          quantite: qte,
          nomOperateur: nom.trim(),
          commentaireLibre: commentaire.trim() || undefined,
        },
      });
      setSuccess({ affaire: res.affaire });
    } catch (e) {
      toast.error((e instanceof Error ? e.message : null) ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !panneau) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-center text-sm">{loadError ?? "Panneau introuvable"}</p>
        <Link to="/scan">
          <Button variant="outline">
            <ScanLine className="h-4 w-4 mr-2" /> Scanner un autre QR
          </Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="text-xl font-semibold text-center">Sortie enregistrée</h1>
        <Card className="p-4 max-w-md w-full text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Panneau :</span>{" "}
            <span className="font-medium">{panneau.matiere?.libelle}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Quantité :</span>{" "}
            <span className="font-medium">{quantite}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Affaire :</span>{" "}
            <span className="font-medium">{success.affaire}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Opérateur :</span>{" "}
            <span className="font-medium">{nom}</span>
          </p>
        </Card>
        <Link to="/scan" className="w-full max-w-md">
          <Button className="w-full h-14 text-base">
            <ScanLine className="h-5 w-5 mr-2" /> Scanner un autre panneau
          </Button>
        </Link>
      </div>
    );
  }

  const m = panneau.matiere as {
    code?: string | null;
    libelle?: string | null;
    famille?: string | null;
    unite_stock?: string | null;
  } | null;
  const stockBas = (panneau.stock_actuel ?? 0) <= 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button onClick={() => navigate({ to: "/scan" })} className="p-1 -ml-1" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">Déclarer une sortie</h1>
      </header>

      <main className="p-4 pb-32 max-w-md mx-auto space-y-4">
        <Card className="p-4">
          <p className="eyebrow mb-2">Panneau scanné</p>
          <h2 className="text-lg font-semibold leading-tight">{m?.libelle ?? "—"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {panneau.longueur_mm} × {panneau.largeur_mm} mm
            {panneau.epaisseur_mm ? ` · ${panneau.epaisseur_mm} mm` : ""}
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stock actuel :</span>
            <span
              className={
                stockBas ? "font-semibold text-destructive" : "font-semibold text-foreground"
              }
            >
              {panneau.stock_actuel ?? 0}
            </span>
          </div>
        </Card>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="affaire">Affaire *</Label>
            <Select value={affaireId} onValueChange={setAffaireId}>
              <SelectTrigger id="affaire" className="mt-1.5">
                <SelectValue placeholder="Choisir une affaire…" />
              </SelectTrigger>
              <SelectContent>
                {affaires.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code_chantier} — {a.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="qte">Quantité à sortir *</Label>
              {panneau.matiere?.unite_stock === "m2" && panneau.longueur_mm && panneau.largeur_mm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const surface = (panneau.longueur_mm * panneau.largeur_mm) / 1_000_000;
                    setQuantite(surface.toFixed(2).replace(/\.?0+$/, ""));
                  }}
                >
                  Panneau entier
                </Button>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-stretch gap-2">
              {panneau.matiere?.unite_stock === "m2" && panneau.longueur_mm && panneau.largeur_mm ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 shrink-0 p-0"
                  aria-label="Retirer 1 panneau"
                  onClick={() => {
                    const surface = (panneau.longueur_mm * panneau.largeur_mm) / 1_000_000;
                    const current = Number(quantite.replace(",", ".")) || 0;
                    const next = Math.max(0, current - surface);
                    setQuantite(next === 0 ? "0" : next.toFixed(2).replace(/\.?0+$/, ""));
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              ) : null}
              <Input
                id="qte"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="text-lg flex-1"
              />
              {panneau.matiere?.unite_stock === "m2" && panneau.longueur_mm && panneau.largeur_mm ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 shrink-0 p-0"
                  aria-label="Ajouter 1 panneau"
                  onClick={() => {
                    const surface = (panneau.longueur_mm * panneau.largeur_mm) / 1_000_000;
                    const current = Number(quantite.replace(",", ".")) || 0;
                    const next = current + surface;
                    setQuantite(next.toFixed(2).replace(/\.?0+$/, ""));
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {panneau.matiere?.unite_stock === "m2" && panneau.longueur_mm && panneau.largeur_mm ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                1 panneau ={" "}
                {((panneau.longueur_mm * panneau.largeur_mm) / 1_000_000).toFixed(2)} m²
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="nom">Ton nom *</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Jean Dupont"
              className="mt-1.5"
              autoComplete="name"
            />
          </div>

          <div>
            <Label htmlFor="cmt">Commentaire (optionnel)</Label>
            <Textarea
              id="cmt"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>

          {/* Sticky footer mobile pour valider sans scroller */}
          <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="max-w-md mx-auto">
              <Button type="submit" className="w-full h-12 text-base" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Valider la sortie
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
