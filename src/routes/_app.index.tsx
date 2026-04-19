import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatEuro, formatNumber } from "@/lib/familles";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Setup Stock" },
      {
        name: "description",
        content: "Vue d'ensemble du stock, des affaires et des bons de commande.",
      },
    ],
  }),
  component: DashboardPage,
});

const sections = [
  {
    num: "01",
    title: "Catalogue",
    desc: "Référentiel matières et panneaux.",
    to: "/catalogue/matieres" as const,
  },
  {
    num: "02",
    title: "Affaires",
    desc: "Suivi par numéro et accès tiers.",
    to: "/affaires" as const,
  },
  {
    num: "03",
    title: "Bons de commande",
    desc: "Import PDF et extraction OCR.",
    to: "/bdc" as const,
  },
  {
    num: "04",
    title: "Mouvements",
    desc: "Entrées, sorties et corrections.",
    to: "/mouvements" as const,
  },
];

function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [kpis, setKpis] = useState<{
    affaires_en_cours: number | null;
    bdc_en_attente: number | null;
    stock_bas: number | null;
    valeur_stock: number | null;
  }>({ affaires_en_cours: null, bdc_en_attente: null, stock_bas: null, valeur_stock: null });

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    void (async () => {
      const [aff, bdc, cat] = await Promise.all([
        supabase
          .from("affaires")
          .select("id", { count: "exact", head: true })
          .eq("statut", "en_cours"),
        supabase
          .from("bons_de_commande")
          .select("id", { count: "exact", head: true })
          .in("statut", ["en_attente_ocr", "ocr_termine"]),
        supabase.from("catalogue_visible").select("stock_actuel, seuil_alerte, valeur_stock_ht"),
      ]);
      let stockBas = 0;
      let valeur = 0;
      for (const r of (cat.data ?? []) as {
        stock_actuel: number | null;
        seuil_alerte: number | null;
        valeur_stock_ht: number | null;
      }[]) {
        const s = Number(r.stock_actuel ?? 0);
        const seuil = Number(r.seuil_alerte ?? 0);
        if (s > 0 && s < seuil) stockBas += 1;
        valeur += Number(r.valeur_stock_ht ?? 0);
      }
      setKpis({
        affaires_en_cours: aff.count ?? 0,
        bdc_en_attente: bdc.count ?? 0,
        stock_bas: stockBas,
        valeur_stock: valeur,
      });
    })();
  }, [authLoading, isAdmin]);

  const cards = [
    {
      label: "Affaires en cours",
      value: kpis.affaires_en_cours,
      hint: "Statut « en cours »",
      format: (v: number) => formatNumber(v, 0),
    },
    {
      label: "BDC en attente",
      value: kpis.bdc_en_attente,
      hint: "À traiter ou valider",
      format: (v: number) => formatNumber(v, 0),
    },
    {
      label: "Stock bas",
      value: kpis.stock_bas,
      hint: "Sous le seuil d'alerte",
      format: (v: number) => formatNumber(v, 0),
    },
    {
      label: "Valeur stock estimée",
      value: kpis.valeur_stock,
      hint: "Au CUMP courant",
      format: (v: number) => formatEuro(v),
    },
  ];

  return (
    <div className="max-w-6xl space-y-16 md:space-y-24">
      <header className="space-y-3">
        <p className="eyebrow">Tableau de bord</p>
        <h1 className="text-3xl md:text-5xl">Vue d'ensemble</h1>
        <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
          Suivi en temps réel de votre stock, de vos affaires et de vos bons de commande
          fournisseurs.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-normal normal-case">
                <span className="font-sans">{kpi.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="font-sans text-3xl md:text-4xl font-semibold text-[color:var(--color-heading)]">
                {kpi.value === null ? "—" : kpi.format(kpi.value)}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="eyebrow">Modules</p>
            <h2 className="text-2xl md:text-3xl">Ce que vous allez gérer</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Link key={s.num} to={s.to}>
              <Card className="p-6 hover:bg-muted/40 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl text-muted-foreground/70">{s.num}</span>
                  <div className="space-y-1">
                    <h3 className="text-lg">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
