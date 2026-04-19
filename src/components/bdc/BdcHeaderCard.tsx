import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatutBdcBadge } from "@/components/StatutBdcBadge";
import { FournisseurPicker, AffairePicker } from "./BdcPickers";
import type { BdcDetail, Fournisseur, Affaire } from "./types";

type HeaderPatch = Partial<
  Pick<BdcDetail, "fournisseur_id" | "numero_bdc" | "date_bdc" | "affaire_id" | "montant_ht_total">
>;

export function BdcHeaderCard({
  bdc,
  setBdc,
  fournisseurs,
  affaires,
  isReadOnly,
  onUpdate,
}: {
  bdc: BdcDetail;
  setBdc: (b: BdcDetail) => void;
  fournisseurs: Fournisseur[];
  affaires: Affaire[];
  isReadOnly: boolean;
  onUpdate: (patch: HeaderPatch) => void;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">En-tête</h2>
        <StatutBdcBadge value={bdc.statut} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Fournisseur</Label>
          <FournisseurPicker
            fournisseurs={fournisseurs}
            value={bdc.fournisseur_id}
            disabled={isReadOnly}
            onChange={(v) => onUpdate({ fournisseur_id: v })}
          />
        </div>
        <div>
          <Label>N° BDC</Label>
          <Input
            value={bdc.numero_bdc ?? ""}
            disabled={isReadOnly}
            onChange={(e) => setBdc({ ...bdc, numero_bdc: e.target.value })}
            onBlur={() => onUpdate({ numero_bdc: bdc.numero_bdc })}
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={bdc.date_bdc ?? ""}
            disabled={isReadOnly}
            onChange={(e) => setBdc({ ...bdc, date_bdc: e.target.value })}
            onBlur={() => onUpdate({ date_bdc: bdc.date_bdc })}
          />
        </div>
        <div>
          <Label>Affaire</Label>
          <AffairePicker
            affaires={affaires}
            value={bdc.affaire_id}
            disabled={isReadOnly}
            onChange={(v) => onUpdate({ affaire_id: v })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Montant HT total annoncé (Mindee)</Label>
          <Input
            type="number"
            step="0.01"
            value={bdc.montant_ht_total ?? ""}
            disabled={isReadOnly}
            onChange={(e) =>
              setBdc({
                ...bdc,
                montant_ht_total: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            onBlur={() => onUpdate({ montant_ht_total: bdc.montant_ht_total })}
          />
        </div>
      </div>
    </Card>
  );
}
