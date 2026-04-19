import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil } from "lucide-react";
import { FamilleBadge } from "@/components/FamilleBadge";
import { formatEuro, formatNumber } from "@/lib/familles";
import type { CatRow } from "./types";
import { stockBadgeClass } from "./types";

export function PanneauxListView({
  loading,
  filtered,
  selected,
  setSelected,
  onToggleActif,
  onEdit,
}: {
  loading: boolean;
  filtered: CatRow[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onToggleActif: (p: CatRow) => void;
  onEdit: (p: CatRow) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-4">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) filtered.forEach((p) => next.add(p.id));
                    else filtered.forEach((p) => next.delete(p.id));
                    setSelected(next);
                  }}
                />
              </th>
              <th className="text-left px-6 py-4 font-medium text-muted-foreground">Matière</th>
              <th className="text-left px-6 py-4 font-medium text-muted-foreground">Dimensions</th>
              <th className="text-right px-6 py-4 font-medium text-muted-foreground">Surface</th>
              <th className="text-right px-6 py-4 font-medium text-muted-foreground">Prix HT</th>
              <th className="text-center px-6 py-4 font-medium text-muted-foreground">Stock</th>
              <th className="text-center px-6 py-4 font-medium text-muted-foreground">Actif</th>
              <th className="px-6 py-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                  Aucune référence
                </td>
              </tr>
            )}
            {filtered.map((p, idx) => (
              <tr
                key={p.id}
                className={`border-b border-border last:border-0 hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/30" : ""} ${!p.actif ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-4">
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
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FamilleBadge famille={p.famille} />
                      {p.typo_nom && <span className="font-medium">{p.typo_nom}</span>}
                      {p.matiere_variante && <span className="text-muted-foreground">{p.matiere_variante}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{p.matiere_code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs tabular-nums">
                  {p.longueur_mm} × {p.largeur_mm} mm
                  {p.epaisseur_mm ? <span className="ml-2 text-muted-foreground">· {p.epaisseur_mm}mm ép.</span> : null}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{formatNumber(p.surface_m2, 3)} m²</td>
                <td className="px-6 py-4 text-right tabular-nums">{formatEuro(p.prix_achat_ht)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium tabular-nums ${stockBadgeClass(p)}`}>
                    {formatNumber(p.stock_actuel, 2)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <Switch checked={p.actif} onCheckedChange={() => onToggleActif(p)} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
