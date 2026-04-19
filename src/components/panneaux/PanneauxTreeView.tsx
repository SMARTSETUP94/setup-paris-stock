import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil, ChevronRight } from "lucide-react";
import { FamilleBadge } from "@/components/FamilleBadge";
import { formatEuro, formatNumber } from "@/lib/familles";
import type { CatRow, TreeMatiere } from "./types";
import { stockBadgeClass } from "./types";

export function PanneauxTreeView({
  loading,
  tree,
  expandedMat,
  expandedFmt,
  toggleMat,
  toggleFmt,
  selected,
  setSelected,
  onToggleActif,
  onEdit,
}: {
  loading: boolean;
  tree: TreeMatiere[];
  expandedMat: Set<string>;
  expandedFmt: Set<string>;
  toggleMat: (key: string) => void;
  toggleFmt: (key: string) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onToggleActif: (p: CatRow) => void;
  onEdit: (p: CatRow) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      {loading && (
        <div className="px-6 py-12 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" />
        </div>
      )}
      {!loading && tree.length === 0 && (
        <div className="px-6 py-12 text-center text-muted-foreground">Aucune référence</div>
      )}
      {!loading &&
        tree.map((m) => {
          const matOpen = expandedMat.has(m.key);
          return (
            <div key={m.key} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => toggleMat(m.key)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 text-left"
              >
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${matOpen ? "rotate-90" : ""}`}
                />
                <FamilleBadge famille={m.famille} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.typo_nom && <span className="font-medium">{m.typo_nom}</span>}
                    {m.matiere_variante && <span className="text-muted-foreground">{m.matiere_variante}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{m.matiere_code}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {m.formats.length} format{m.formats.length > 1 ? "s" : ""} · {m.totalPanneaux} panneau
                  {m.totalPanneaux > 1 ? "x" : ""}
                </div>
                <span className="inline-block px-2 py-0.5 rounded border text-xs font-medium tabular-nums bg-muted text-muted-foreground border-border">
                  Stock {formatNumber(m.totalStock, 2)}
                </span>
              </button>

              {matOpen &&
                m.formats.map((f) => {
                  const fmtKey = `${m.key}::${f.key}`;
                  const fmtOpen = expandedFmt.has(fmtKey);
                  const fmtStock = f.panneaux.reduce((s, p) => s + p.stock_actuel, 0);
                  return (
                    <div key={fmtKey} className="border-t border-border bg-muted/20">
                      <button
                        type="button"
                        onClick={() => toggleFmt(fmtKey)}
                        className="w-full pl-12 pr-4 py-2 flex items-center gap-3 hover:bg-muted/40 text-left"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${fmtOpen ? "rotate-90" : ""}`}
                        />
                        <span className="font-mono text-xs tabular-nums">
                          {f.longueur} × {f.largeur} mm
                        </span>
                        <span className="text-xs text-muted-foreground">· {formatNumber(f.surface, 3)} m²</span>
                        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {f.panneaux.length} épaisseur{f.panneaux.length > 1 ? "s" : ""} · stock {formatNumber(fmtStock, 2)}
                        </div>
                      </button>

                      {fmtOpen && (
                        <table className="w-full text-sm">
                          <tbody>
                            {f.panneaux.map((p) => (
                              <tr
                                key={p.id}
                                className={`border-t border-border hover:bg-background ${!p.actif ? "opacity-60" : ""}`}
                              >
                                <td className="w-10 pl-16 pr-2 py-2">
                                  <Checkbox
                                    checked={selected.has(p.id)}
                                    onCheckedChange={(v) => {
                                      const next = new Set(selected);
                                      if (v) next.add(p.id);
                                      else next.delete(p.id);
                                      setSelected(next);
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-xs tabular-nums w-24">
                                  {p.epaisseur_mm} mm
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatEuro(p.prix_achat_ht)}</td>
                                <td className="px-3 py-2 text-center w-24">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border text-xs font-medium tabular-nums ${stockBadgeClass(p)}`}
                                  >
                                    {formatNumber(p.stock_actuel, 2)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center w-20">
                                  <Switch checked={p.actif} onCheckedChange={() => onToggleActif(p)} />
                                </td>
                                <td className="px-3 py-2 text-right w-16">
                                  <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
    </Card>
  );
}
