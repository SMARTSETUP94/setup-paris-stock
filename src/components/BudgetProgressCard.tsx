import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/familles";

interface Props {
  budget: number | null;
  consomme: number;
  dateDebut?: string | null;
  dateFin?: string | null;
  onDefineBudget?: () => void;
}

function getColor(pct: number): { bar: string; text: string } {
  if (pct > 100) return { bar: "bg-[#ef4444]", text: "text-[#ef4444]" };
  if (pct >= 80) return { bar: "bg-[#f59e0b]", text: "text-[#f59e0b]" };
  return { bar: "bg-[#10b981]", text: "text-[#10b981]" };
}

function diffJours(debut?: string | null, fin?: string | null): number | null {
  if (!debut) return null;
  const d1 = new Date(debut).getTime();
  const d2 = fin ? new Date(fin).getTime() : Date.now();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export function BudgetProgressCard({
  budget,
  consomme,
  dateDebut,
  dateFin,
  onDefineBudget,
}: Props) {
  const duree = diffJours(dateDebut, dateFin);

  if (!budget || budget <= 0) {
    return (
      <Card className="p-6">
        <p className="eyebrow mb-2">Consommation panneaux</p>
        <p className="text-2xl font-semibold">{formatEuro(consomme)}</p>
        <p className="text-xs text-muted-foreground mt-1">Pas de budget défini</p>
        {onDefineBudget && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onDefineBudget}>
            <Plus className="h-4 w-4" /> Définir un budget
          </Button>
        )}
        {duree !== null && (
          <p className="text-xs text-muted-foreground mt-3">
            Durée {duree} jour{duree > 1 ? "s" : ""}
          </p>
        )}
      </Card>
    );
  }

  const pct = (consomme / budget) * 100;
  const pctClamped = Math.min(100, Math.max(0, pct));
  const restantPct = Math.max(0, 100 - pct);
  const { bar, text } = getColor(pct);

  return (
    <Card className="p-6">
      <p className="eyebrow mb-2">Consommation panneaux</p>
      <p className="text-2xl font-semibold">
        {formatEuro(consomme)}{" "}
        <span className="text-base font-normal text-muted-foreground">
          sur {formatEuro(budget)}
        </span>
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${bar} transition-all`}
          style={{ width: `${pctClamped}%` }}
          aria-label={`Progression budget ${pct.toFixed(0)}%`}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        <span className={`font-medium ${text}`}>{pct.toFixed(0)}% du budget</span>
        {pct <= 100
          ? ` · ${restantPct.toFixed(0)}% restant`
          : ` · dépassement ${(pct - 100).toFixed(0)}%`}
        {duree !== null && ` · durée ${duree} jour${duree > 1 ? "s" : ""}`}
      </p>
    </Card>
  );
}
