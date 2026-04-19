import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FAMILLES, type Famille, formatNumber } from "@/lib/familles";
import { Loader2 } from "lucide-react";

type Periode = 7 | 30 | 90;

type Row = {
  jour: string; // "DD/MM"
} & Partial<Record<Famille, number>>;

const PERIODES: { value: Periode; label: string }[] = [
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
  { value: 90, label: "90 j" },
];

export function DashboardConsoChart() {
  const [periode, setPeriode] = useState<Periode>(30);
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - periode);
      const sinceIso = since.toISOString();

      // On récupère les sorties de la période avec la surface unitaire et la famille du panneau.
      // Métrique = m² consommés = |quantite| × surface_m2
      // (surface_m2 est calculée par l'app pour tous les panneaux ; si null on ignore la ligne)
      const { data: rows, error } = await supabase
        .from("mouvements_stock")
        .select("created_at, quantite, panneau:panneaux(surface_m2, matiere:matieres(famille))")
        .eq("type", "sortie")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[Dashboard] conso 30j", error);
        setData([]);
        setLoading(false);
        return;
      }

      // Bucket par jour
      const buckets = new Map<string, Record<string, number>>();
      const now = new Date();
      for (let i = periode - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, {});
      }

      for (const r of (rows ?? []) as Array<{
        created_at: string;
        quantite: number;
        panneau: {
          surface_m2: number | null;
          matiere: { famille: Famille | null } | null;
        } | null;
      }>) {
        const key = r.created_at.slice(0, 10);
        if (!buckets.has(key)) continue;
        const surface = Number(r.panneau?.surface_m2 ?? 0);
        if (!surface) continue;
        const famille = r.panneau?.matiere?.famille ?? "autre";
        const m2 = Math.abs(Number(r.quantite ?? 0)) * surface;
        const bucket = buckets.get(key)!;
        bucket[famille] = (bucket[famille] ?? 0) + m2;
      }

      const rowsOut: Row[] = Array.from(buckets.entries()).map(([day, val]) => {
        const d = new Date(day);
        return {
          jour: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          ...val,
        } as Row;
      });

      setData(rowsOut);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [periode]);

  const famillesAffichees = useMemo(() => {
    // N'affiche que les familles présentes dans les données pour limiter la légende
    const present = new Set<string>();
    for (const row of data) {
      for (const f of FAMILLES) {
        if (row[f.value] && Number(row[f.value]) > 0) present.add(f.value);
      }
    }
    return FAMILLES.filter((f) => present.has(f.value));
  }, [data]);

  const total = useMemo(() => {
    let t = 0;
    for (const row of data) {
      for (const f of FAMILLES) t += Number(row[f.value] ?? 0);
    }
    return t;
  }, [data]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold">Consommation par famille</h2>
          <p className="text-xs text-muted-foreground">
            Surface m² sortie sur {periode} jours · total {formatNumber(total, 1)} m²
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {PERIODES.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={periode === p.value ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setPeriode(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : famillesAffichees.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Aucune sortie sur cette période.
        </div>
      ) : (
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="jour"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  `${formatNumber(value, 2)} m²`,
                  FAMILLES.find((f) => f.value === name)?.label ?? name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => FAMILLES.find((f) => f.value === value)?.label ?? value}
              />
              {famillesAffichees.map((f) => (
                <Bar key={f.value} dataKey={f.value} stackId="a" fill={f.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
