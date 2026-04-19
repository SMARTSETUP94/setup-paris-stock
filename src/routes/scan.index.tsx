import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Camera, AlertCircle, Zap } from "lucide-react";

export const Route = createFileRoute("/scan/")({
  head: () => ({
    meta: [
      { title: "Scanner un panneau — Setup Stock" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      if (!elRef.current) return;
      const id = "qr-reader";
      elRef.current.id = id;
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;

      // Timeout 10s : si la caméra ne démarre pas, on bascule en mode dégradé
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
      } catch (e: any) {
        setError(
          e?.message?.includes("Permission")
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
      }
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
            <Zap className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">SET UP</p>
            <p className="text-[10px] text-muted-foreground -mt-0.5">Atelier</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Scanner</span>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 gap-4">
        <Card className="w-full max-w-md p-3">
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
          <Card className="w-full max-w-md p-4 border-warning bg-warning/5">
            <div className="flex gap-2 items-start text-sm">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Caméra indisponible</p>
                <p className="text-xs text-muted-foreground">
                  Raisons possibles :
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  <li>Permission refusée (vérifie les réglages du téléphone)</li>
                  <li>Pas de caméra arrière détectée</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  La recherche par texte sera bientôt disponible ici.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Réessayer
                </Button>
              </div>
            </div>
          </Card>
        )}

        {error && (
          <Card className="w-full max-w-md p-4 border-destructive bg-destructive/5">
            <div className="flex gap-2 items-start text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Réessayer
                </Button>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center max-w-md">
          Pointe la caméra vers le QR code collé sur le panneau.
        </p>
      </main>
    </div>
  );
}
