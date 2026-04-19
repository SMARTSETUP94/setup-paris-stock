import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FamilleBadge } from "@/components/FamilleBadge";
import {
  Search,
  Loader2,
  Camera,
  AlertCircle,
  ListChecks,
  QrCode,
  Save,
  Trash2,
  RotateCw,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { FAMILLES, formatNumber, uniteLabel, type Famille } from "@/lib/familles";
import { useStockRealtime } from "@/hooks/useStockRealtime";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/inventaire")({
  head: () => ({ meta: [{ title: "Inventaire — Setup Stock" }] }),
  component: InventairePage,
});

type CatRow = {
  id: string;
  matiere_id: string;
  matiere_code: string;
  matiere_libelle: string;
  famille: Famille | null;
  longueur_mm: number;
  largeur_mm: number;
  unite_stock: Database["public"]["Enums"]["unite_stock"] | null;
  stock_actuel: number;
};

type Counts = Map<string, number>; // panneauId → qté comptée

const STORAGE_KEY = "inventaire-session-v1";

function loadSession(): Counts {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}
function saveSession(c: Counts) {
  if (typeof window === "undefined") return;
  const obj: Record<string, number> = {};
  c.forEach((v, k) => {
    obj[k] = v;
  });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function InventairePage() {
  const { ready } = useAdminGuard();
  const { user } = useAuth();
  const [items, setItems] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debQ = useDebounced(q);
  const [familleFilter, setFamilleFilter] = useState<string>("all");
  const [hideZero, setHideZero] = useState(false);
  const [counts, setCounts] = useState<Counts>(() => new Map());
  const [tab, setTab] = useState<"liste" | "scan">("liste");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");

  // Hydrate la session depuis localStorage côté client uniquement
  useEffect(() => {
    setCounts(loadSession());
  }, []);

  useEffect(() => {
    saveSession(counts);
  }, [counts]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("catalogue_visible")
      .select(
        "id, matiere_id, matiere_code, matiere_libelle, famille, longueur_mm, largeur_mm, unite_stock, stock_actuel, actif",
      )
      .eq("actif", true)
      .order("matiere_libelle", { ascending: true })
      .limit(2000);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as CatRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  // Stock temps réel : recharge le catalogue à chaque nouveau mouvement
  useStockRealtime(() => { void load(); }, ready);


  const filtered = useMemo(() => {
    const t = debQ.trim().toLowerCase();
    return items.filter((p) => {
      if (familleFilter !== "all" && p.famille !== familleFilter) return false;
      if (hideZero && Number(p.stock_actuel ?? 0) === 0 && !counts.has(p.id)) return false;
      if (!t) return true;
      return (
        p.matiere_libelle.toLowerCase().includes(t) ||
        p.matiere_code.toLowerCase().includes(t) ||
        `${p.longueur_mm}x${p.largeur_mm}`.includes(t.replace(/\s/g, ""))
      );
    });
  }, [items, debQ, familleFilter, hideZero, counts]);

  const ecarts = useMemo(() => {
    const list: { row: CatRow; compte: number; ecart: number }[] = [];
    counts.forEach((compte, panneauId) => {
      const row = items.find((r) => r.id === panneauId);
      if (!row) return;
      const ecart = compte - Number(row.stock_actuel ?? 0);
      if (ecart !== 0) list.push({ row, compte, ecart });
    });
    return list;
  }, [counts, items]);

  function setCount(panneauId: string, value: string) {
    const num = Number(value.replace(",", "."));
    setCounts((prev) => {
      const next = new Map(prev);
      if (value === "" || !Number.isFinite(num) || num < 0) {
        next.delete(panneauId);
      } else {
        next.set(panneauId, num);
      }
      return next;
    });
  }

  function clearSession() {
    if (counts.size === 0) return;
    if (!window.confirm("Vider toute la session d'inventaire en cours ?")) return;
    setCounts(new Map());
  }

  async function commitCorrections() {
    if (ecarts.length === 0) {
      toast.error("Aucun écart à enregistrer");
      return;
    }
    if (!comment.trim()) {
      toast.error("Motif obligatoire pour les corrections");
      return;
    }
    setSubmitting(true);
    const baseComment = `Inventaire physique — ${comment.trim()}`;
    const payload = ecarts.map(({ row, ecart }) => ({
      panneau_id: row.id,
      type: "correction" as const,
      quantite: ecart, // signe ok : >0 ajoute, <0 retire
      affaire_id: null,
      commentaire: baseComment,
      effectue_par: user?.id ?? null,
    }));

    const { error } = await supabase.from("mouvements_stock").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ecarts.length} correction(s) enregistrée(s)`);
    setCounts(new Map());
    setComment("");
    setConfirmOpen(false);
    void load();
  }

  if (!ready) return <AdminLoader />;

  const totalCounted = counts.size;
  const totalEcarts = ecarts.length;

  return (
    <div>
      <PageHeader
        eyebrow="Inventaire"
        title="Inventaire physique"
        description="Compte le stock réel (à la liste ou par scan QR), génère des corrections pour les écarts. La session est sauvegardée localement."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearSession} disabled={counts.size === 0}>
              <Trash2 className="h-4 w-4 mr-2" /> Vider
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={totalEcarts === 0}>
              <Save className="h-4 w-4 mr-2" /> Valider{" "}
              {totalEcarts > 0 ? `(${totalEcarts} écart${totalEcarts > 1 ? "s" : ""})` : ""}
            </Button>
          </div>
        }
      />

      {/* Stats session */}
      <Card className="p-4 mb-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Panneaux comptés</div>
          <div className="text-2xl font-semibold tabular-nums">{totalCounted}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Écarts détectés</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${totalEcarts > 0 ? "text-amber-700" : ""}`}
          >
            {totalEcarts}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Restants</div>
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
            {Math.max(0, items.length - totalCounted)}
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "liste" | "scan")}>
        <TabsList className="mb-4">
          <TabsTrigger value="liste">
            <ListChecks className="h-4 w-4 mr-2" /> Liste
          </TabsTrigger>
          <TabsTrigger value="scan">
            <QrCode className="h-4 w-4 mr-2" /> Scan QR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <Card className="p-4 mb-4">
            <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher matière, code, dimensions…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Select value={familleFilter} onValueChange={setFamilleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Famille" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes familles</SelectItem>
                  {FAMILLES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap px-2">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                />
                Masquer stock 0
              </label>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3 font-medium">Matière</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Dimensions</th>
                      <th className="text-right p-3 font-medium">Stock système</th>
                      <th className="text-right p-3 font-medium w-[140px]">Compté</th>
                      <th className="text-right p-3 font-medium w-[100px]">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const counted = counts.get(p.id);
                      const stock = Number(p.stock_actuel ?? 0);
                      const ecart = counted !== undefined ? counted - stock : null;
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="p-3">
                            <div className="font-medium">{p.matiere_libelle}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {p.matiere_code}
                              </span>
                              {p.famille && <FamilleBadge famille={p.famille} />}
                            </div>
                          </td>
                          <td className="p-3 tabular-nums hidden md:table-cell text-muted-foreground">
                            {p.longueur_mm} × {p.largeur_mm}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {formatNumber(stock, 2)}
                            <span className="text-xs text-muted-foreground ml-1">
                              {uniteLabel(p.unite_stock)}
                            </span>
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              value={counted ?? ""}
                              onChange={(e) => setCount(p.id, e.target.value)}
                              placeholder="—"
                              className="h-9 text-right tabular-nums"
                            />
                          </td>
                          <td
                            className={`p-3 text-right tabular-nums font-medium ${
                              ecart === null
                                ? "text-muted-foreground"
                                : ecart === 0
                                  ? "text-emerald-700"
                                  : ecart > 0
                                    ? "text-blue-700"
                                    : "text-rose-700"
                            }`}
                          >
                            {ecart === null ? "—" : (ecart > 0 ? "+" : "") + formatNumber(ecart, 2)}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Aucun panneau
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} panneau(x) affiché(s) · session sauvegardée localement (vous pouvez
            fermer l'onglet)
          </p>
        </TabsContent>

        <TabsContent value="scan">
          <ScanInventaire items={items} counts={counts} setCount={setCount} />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider l'inventaire</DialogTitle>
            <DialogDescription>
              {ecarts.length} correction{ecarts.length > 1 ? "s" : ""} seront créées (immuables).
              Les panneaux comptés sans écart ne génèrent rien.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Matière</th>
                  <th className="text-right p-2 font-medium">Système</th>
                  <th className="text-right p-2 font-medium">Compté</th>
                  <th className="text-right p-2 font-medium">Écart</th>
                </tr>
              </thead>
              <tbody>
                {ecarts.map(({ row, compte, ecart }) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-2">
                      <div className="font-medium truncate">{row.matiere_libelle}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.matiere_code} · {row.longueur_mm}×{row.largeur_mm}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">
                      {formatNumber(Number(row.stock_actuel ?? 0), 2)}
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatNumber(compte, 2)}</td>
                    <td
                      className={`p-2 text-right tabular-nums font-medium ${ecart > 0 ? "text-blue-700" : "text-rose-700"}`}
                    >
                      {(ecart > 0 ? "+" : "") + formatNumber(ecart, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Label>Motif *</Label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ex : Inventaire trimestriel atelier — janvier 2026"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={commitCorrections} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmer {ecarts.length} correction{ecarts.length > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Mode scan -------------------- */

function ScanInventaire({
  items,
  counts,
  setCount,
}: {
  items: CatRow[];
  counts: Counts;
  setCount: (id: string, v: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const current = currentId ? (items.find((i) => i.id === currentId) ?? null) : null;

  async function startScan() {
    setError(null);
    setScanning(true);
    // Laisse React rendre le div d'abord
    await new Promise((r) => setTimeout(r, 50));
    if (!elRef.current) return;
    const id = "qr-inv-reader";
    elRef.current.id = id;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          const m = decoded.match(/\/scan\/([0-9a-f-]{36})/i);
          const pid = m?.[1];
          if (!pid) {
            setError("QR invalide");
            return;
          }
          const found = items.find((i) => i.id === pid);
          if (!found) {
            setError("Panneau inconnu (peut-être désactivé)");
            return;
          }
          setError(null);
          setCurrentId(pid);
          setQty(counts.get(pid)?.toString() ?? "");
          stopScan();
        },
        () => {},
      );
    } catch (e: any) {
      setError(
        e?.message?.includes("Permission")
          ? "Accès caméra refusé"
          : "Impossible de démarrer la caméra",
      );
      setScanning(false);
    }
  }

  function stopScan() {
    const s = scannerRef.current;
    if (s) {
      s.stop()
        .then(() => s.clear())
        .catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    if (!current) return;
    setCount(current.id, qty);
    setCurrentId(null);
    setQty("");
    // relance auto le scan pour enchaîner
    void startScan();
  }

  function skip() {
    setCurrentId(null);
    setQty("");
    void startScan();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Caméra</h3>
          {scanning ? (
            <Button size="sm" variant="outline" onClick={stopScan}>
              Arrêter
            </Button>
          ) : (
            <Button size="sm" onClick={startScan}>
              <Camera className="h-4 w-4 mr-2" /> Démarrer
            </Button>
          )}
        </div>

        <div className="aspect-square bg-black rounded overflow-hidden relative">
          {scanning ? (
            <div ref={elRef} className="w-full h-full" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-sm gap-2 p-6 text-center">
              <QrCode className="h-10 w-10 opacity-60" />
              <p className="opacity-80">Démarre la caméra et pointe vers un QR panneau.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex gap-2 items-start text-xs text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Saisie quantité comptée</h3>
        {!current ? (
          <p className="text-sm text-muted-foreground py-8 text-center">En attente d'un scan…</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-3 bg-muted/30">
              <div className="font-semibold">{current.matiere_libelle}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {current.matiere_code} · {current.longueur_mm}×{current.largeur_mm} mm
              </div>
              <div className="text-xs mt-2">
                Stock système :{" "}
                <span className="font-semibold tabular-nums">
                  {formatNumber(Number(current.stock_actuel ?? 0), 2)}{" "}
                  {uniteLabel(current.unite_stock)}
                </span>
              </div>
            </div>

            <div>
              <Label>Quantité comptée *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                autoFocus
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") validate();
                }}
                placeholder="0"
                className="text-lg h-12 text-right tabular-nums"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={skip}>
                <RotateCw className="h-4 w-4 mr-2" /> Passer
              </Button>
              <Button className="flex-1" onClick={validate} disabled={qty === ""}>
                <Check className="h-4 w-4 mr-2" /> Valider & suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
