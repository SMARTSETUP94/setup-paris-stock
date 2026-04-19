/**
 * ============================================================
 * ROUTE PUBLIQUE — /scan
 * ============================================================
 *
 * Cette page est ACCESSIBLE SANS AUTHENTIFICATION pour permettre aux
 * ouvriers atelier de scanner les QR codes des panneaux et déclarer
 * une sortie immédiate, même depuis un téléphone non connecté à un
 * compte Setup.
 *
 * Mitigations : voir src/lib/scan.functions.ts (entête).
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
// html5-qrcode (~250 kB) chargé à la demande pour alléger le bundle initial /scan.
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Camera, AlertCircle, Search, QrCode, Package, Layers } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPanneauxPublic, type PanneauSearchResult } from "@/lib/scan.functions";
import { BrandingLogo } from "@/components/BrandingLogo";
import { useBranding } from "@/hooks/useBranding";
import { CascadeSelector } from "@/components/scan/CascadeSelector";

export const Route = createFileRoute("/scan/")({
  head: () => ({
    meta: [{ title: "Scanner un panneau — Setup Stock" }, { name: "robots", content: "noindex" }],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const searchFn = useServerFn(listPanneauxPublic);
  const [tab, setTab] = useState<"scan" | "search">("scan");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  // Recherche texte (fallback)
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PanneauSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (tab !== "scan") return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setStarting(true);
    setTimedOut(false);
    setError(null);
    stoppedRef.current = false;

    async function start() {
      if (!elRef.current) return;
      const id = "qr-reader";
      elRef.current.id = id;
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;

      timeoutId = setTimeout(() => {
        if (!cancelled && stoppedRef.current === false) {
          setTimedOut(true);
        }
      }, 10000);

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            const match = decoded.match(/\/scan\/([0-9a-f-]{36})/i);
            const id = match?.[1];
            if (id) {
              scanner.stop().catch(() => {});
              navigate({ to: "/scan/$panneauId", params: { panneauId: id } });
            } else {
              stoppedRef.current = false;
              setError("QR invalide : ce n'est pas une étiquette panneau");
            }
          },
          () => {},
        );
        if (!cancelled) {
          setStarting(false);
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setError(
          msg.includes("Permission")
            ? "Accès caméra refusé. Autorise-le dans les paramètres du navigateur."
            : "Impossible de démarrer la caméra",
        );
        setStarting(false);
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [navigate, tab]);

  // Recherche debouncée 300ms
  useEffect(() => {
    const term = q.trim();
    if (term.length === 0) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFn({ data: { q: term } });
        setResults(res.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, searchFn]);

  // Si caméra timeout, on bascule auto sur l'onglet recherche en suggestion
  function switchToSearch() {
    setTab("search");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandingLogo size="sm" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">
            Atelier
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Sortie panneau</span>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 gap-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "scan" | "search")}
          className="w-full max-w-md"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Rechercher
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-4 space-y-4">
            <Card className="p-3">
              <div className="aspect-square bg-black rounded overflow-hidden relative">
                <div ref={elRef} className="w-full h-full" />
                {starting && !timedOut && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Démarrage caméra…
                  </div>
                )}
              </div>
            </Card>

            {timedOut && !error && (
              <Card className="p-4 border-warning bg-warning/5">
                <div className="flex gap-2 items-start text-sm">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="font-medium">Caméra indisponible</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      <li>Permission refusée (vérifie les réglages du téléphone)</li>
                      <li>Pas de caméra arrière détectée</li>
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                        <Camera className="h-3.5 w-3.5 mr-1.5" /> Réessayer
                      </Button>
                      <Button size="sm" onClick={switchToSearch}>
                        <Search className="h-3.5 w-3.5 mr-1.5" /> Recherche texte
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {error && (
              <Card className="p-4 border-destructive bg-destructive/5">
                <div className="flex gap-2 items-start text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">{error}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                        <Camera className="h-3.5 w-3.5 mr-1.5" /> Réessayer
                      </Button>
                      <Button size="sm" onClick={switchToSearch}>
                        <Search className="h-3.5 w-3.5 mr-1.5" /> Recherche texte
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Pointe la caméra vers le QR code collé sur le panneau.
            </p>
          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-3">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="h-4 w-4 text-muted-foreground" />
                Chercher un panneau par code ou libellé
              </div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex. MDF-19 ou « Médium 3050 »"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Si la caméra ne marche pas, retrouve ton panneau ici.
              </p>
            </Card>

            <div className="space-y-2">
              {searching && (
                <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Recherche…
                </div>
              )}
              {!searching && q.trim().length > 0 && results.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  Aucun panneau trouvé pour « {q} »
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate({ to: "/scan/$panneauId", params: { panneauId: r.id } })}
                  className="w-full text-left"
                >
                  <Card className="p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.matiere_libelle ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{r.matiere_code ?? "?"}</span>
                          {" · "}
                          {r.longueur_mm}×{r.largeur_mm}×{r.epaisseur_mm} mm
                        </p>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
