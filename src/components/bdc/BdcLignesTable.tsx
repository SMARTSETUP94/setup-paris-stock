import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, AlertTriangle, Check as CheckIcon } from "lucide-react";
import { confidenceMeta } from "@/lib/bdc";
import { formatEuro } from "@/lib/familles";
import { PanneauPicker } from "./BdcPickers";
import type { LigneRow, PanneauOption } from "./types";

export function BdcLignesTable({
  lignes,
  panneaux,
  confidenceByLigne,
  isReadOnly,
  totalCalcule,
  montantHtTotal,
  ecartTotal,
  onAddLigne,
  onUpdateLigne,
  onSaveLigne,
  onDeleteLigne,
}: {
  lignes: LigneRow[];
  panneaux: PanneauOption[];
  confidenceByLigne: Record<number, number | null>;
  isReadOnly: boolean;
  totalCalcule: number;
  montantHtTotal: number | null;
  ecartTotal: number;
  onAddLigne: () => void;
  onUpdateLigne: (id: string, patch: Partial<LigneRow>) => void;
  onSaveLigne: (l: LigneRow) => void;
  onDeleteLigne: (id: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Lignes ({lignes.length})</h2>
        {!isReadOnly && (
          <Button size="sm" variant="outline" onClick={onAddLigne}>
            + Ajouter une ligne
          </Button>
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
                    <td
                      className="px-3 py-3 text-xs text-muted-foreground max-w-[180px] truncate"
                      title={l.matiere_libelle_brut ?? ""}
                    >
                      {l.matiere_libelle_brut ?? "—"}
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      <PanneauPicker
                        panneaux={panneaux}
                        value={l.panneau_id}
                        disabled={isReadOnly}
                        onChange={(v) => {
                          onUpdateLigne(l.id, { panneau_id: v });
                          onSaveLigne({ ...l, panneau_id: v });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 w-20">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-right"
                        value={l.quantite}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateLigne(l.id, { quantite: Number(e.target.value) })}
                        onBlur={() => onSaveLigne(l)}
                      />
                    </td>
                    <td className="px-3 py-2 w-24">
                      <Input
                        type="number"
                        step="0.0001"
                        className="h-8 text-right"
                        value={l.prix_unitaire_ht}
                        disabled={isReadOnly}
                        onChange={(e) =>
                          onUpdateLigne(l.id, { prix_unitaire_ht: Number(e.target.value) })
                        }
                        onBlur={() => onSaveLigne(l)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs">{formatEuro(valeur)}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ color: cm.color, backgroundColor: cm.bg }}
                      >
                        {cm.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Checkbox
                        checked={l.ligne_validee}
                        disabled={isReadOnly || !l.panneau_id}
                        onCheckedChange={(v) => {
                          onUpdateLigne(l.id, { ligne_validee: !!v });
                          onSaveLigne({ ...l, ligne_validee: !!v });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isReadOnly && (
                        <Button variant="ghost" size="sm" onClick={() => onDeleteLigne(l.id)}>
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
                <td colSpan={4} className="px-3 py-3 text-right text-xs text-muted-foreground">
                  Total des lignes cochées
                </td>
                <td className="px-3 py-3 text-right font-semibold">{formatEuro(totalCalcule)}</td>
                <td colSpan={3} className="px-3 py-3">
                  {montantHtTotal !== null &&
                    totalCalcule > 0 &&
                    (ecartTotal > 0.05 ? (
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
                    ))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
