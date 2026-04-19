import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard, AdminLoader, useDebounced } from "@/hooks/useAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/catalogue/etiquettes")({
  head: () => ({ meta: [{ title: "Étiquettes QR — Setup Stock" }] }),
  component: EtiquettesPage,
});

type PanRow = {
  id: string;
  longueur_mm: number;
  largeur_mm: number;
  matiere_libelle: string;
  matiere_code: string;
  famille: string;
  reference_fournisseur: string | null;
};

function EtiquettesPage() {
  const { ready } = useAdminGuard();
  const [items, setItems] = useState<PanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debQ = useDebounced(q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrDataMap, setQrDataMap] = useState<Map<string, string>>(new Map());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("catalogue_visible")
      .select(
        "id, longueur_mm, largeur_mm, matiere_libelle, matiere_code, famille, reference_fournisseur",
      )
      .eq("actif", true)
      .order("matiere_libelle", { ascending: true })
      .limit(500);
    if (error) {
      toast.error(error.message);
    } else {
      setItems((data ?? []) as PanRow[]);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const t = debQ.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (p) =>
        p.matiere_libelle.toLowerCase().includes(t) ||
        p.matiere_code.toLowerCase().includes(t) ||
        `${p.longueur_mm}x${p.largeur_mm}`.includes(t.replace(/\s/g, "")),
    );
  }, [items, debQ]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (filtered.every((p) => selected.has(p.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  async function generateAndPrint() {
    if (selected.size === 0) {
      toast.error("Sélectionne au moins un panneau");
      return;
    }
    setGenerating(true);
    try {
      const map = new Map<string, string>();
      const origin = window.location.origin;
      for (const id of selected) {
        const url = `${origin}/scan/${id}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        map.set(id, dataUrl);
      }
      setQrDataMap(map);
      // Laisse le DOM se rafraîchir avant impression
      setTimeout(() => window.print(), 200);
    } catch (e) {
      toast.error((e instanceof Error ? e.message : String(e)) ?? "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  }

  if (!ready || loading) return <AdminLoader />;

  const selectedItems = items.filter((p) => selected.has(p.id));

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Catalogue"
          title="Étiquettes QR"
          description="Sélectionne les panneaux puis imprime une planche A4 d'étiquettes à coller en atelier. Chaque QR ouvre la page de sortie scan."
          actions={
            <Button onClick={generateAndPrint} disabled={selected.size === 0 || generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Imprimer ({selected.size})
            </Button>
          }
        />

        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher matière, code, dimensions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {filtered.every((p) => selected.has(p.id)) && filtered.length > 0
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="w-10 p-3"></th>
                  <th className="text-left p-3 font-medium">Matière</th>
                  <th className="text-left p-3 font-medium">Dimensions</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Famille</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className="border-t border-border cursor-pointer hover:bg-muted/30"
                  >
                    <td className="p-3">
                      <Checkbox checked={selected.has(p.id)} />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{p.matiere_libelle}</div>
                      <div className="text-xs text-muted-foreground">{p.matiere_code}</div>
                    </td>
                    <td className="p-3 tabular-nums">
                      {p.longueur_mm} × {p.largeur_mm} mm
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{p.famille}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Aucun panneau
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Zone d'impression : 3 colonnes × N lignes sur A4 */}
      <div className="hidden print:block">
        <div className="grid grid-cols-3 gap-2">
          {selectedItems.map((p) => {
            const dataUrl = qrDataMap.get(p.id);
            return (
              <div
                key={p.id}
                className="border border-black p-2 flex flex-col items-center text-center break-inside-avoid"
                style={{ height: "90mm" }}
              >
                {dataUrl && <img src={dataUrl} alt="" className="w-32 h-32" />}
                <div className="mt-2 font-bold text-xs leading-tight">{p.matiere_libelle}</div>
                <div className="text-xs">
                  {p.longueur_mm} × {p.largeur_mm} mm
                </div>
                <div className="text-[10px] mt-1" style={{ color: "#555" }}>
                  {p.matiere_code}
                </div>
                {p.reference_fournisseur && (
                  <div className="text-[10px]" style={{ color: "#555" }}>
                    Ref: {p.reference_fournisseur}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
