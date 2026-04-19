import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Plus, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStockRealtime } from "@/hooks/useStockRealtime";
import { formatEuro, formatNumber } from "@/lib/familles";
import { DashboardConsoChart } from "@/components/dashboard/DashboardConsoChart";
import { RecentMouvementsCard, type MouvementRecent } from "@/components/dashboard/RecentMouvementsCard";
import { AffaireFormDialog } from "@/components/AffaireFormDialog";

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

type AlerteBas = {
  id: string;
  matiere_code: string | null;
  matiere_libelle: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
  stock_actuel: number | null;
  seuil_alerte: number | null;
};

type TopAffaire = {
  id: string;
  code_chantier: string;
  client: string;
  valeur: number;
};




function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [kpis, setKpis] = useState<{
    affaires_en_cours: number | null;
    bdc_en_attente: number | null;
    stock_bas: number | null;
    valeur_stock: number | null;
  }>({
    affaires_en_cours: null,
    bdc_en_attente: null,
    stock_bas: null,
    valeur_stock: null,
  });
  const [alertes, setAlertes] = useState<AlerteBas[]>([]);
  const [topAffaires, setTopAffaires] = useState<TopAffaire[]>([]);
  const [mouvements, setMouvements] = useState<MouvementRecent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [openNewAffaire, setOpenNewAffaire] = useState(false);

  async function loadDashboard() {
    const [aff, bdc, cat, mvtData] = await Promise.all([
      supabase
        .from("affaires")
        .select("id", { count: "exact", head: true })
        .eq("statut", "en_cours"),
      supabase
        .from("bons_de_commande")
        .select("id", { count: "exact", head: true })
        .in("statut", ["en_attente_ocr", "ocr_termine"]),
      supabase
        .from("catalogue_visible")
        .select(
          "id, matiere_code, matiere_libelle, longueur_mm, largeur_mm, stock_actuel, seuil_alerte, valeur_stock_ht",
        ),
      supabase
        .from("mouvements_stock")
        .select(
          "id, type, quantite, created_at, panneau:panneaux(longueur_mm, largeur_mm, matiere:matieres(code, libelle)), affaire:affaires(code_chantier)",
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    let stockBas = 0;
    let valeur = 0;
    const alertesList: AlerteBas[] = [];
    for (const r of (cat.data ?? []) as (AlerteBas & { valeur_stock_ht: number | null })[]) {
      const s = Number(r.stock_actuel ?? 0);
      const seuil = Number(r.seuil_alerte ?? 0);
      if (seuil > 0 && s < seuil) {
        stockBas += 1;
        alertesList.push(r);
      }
      valeur += Number(r.valeur_stock_ht ?? 0);
    }
    // Trier alertes par "criticité" : ratio stock/seuil croissant (plus bas en premier)
    alertesList.sort((a, b) => {
      const ra = Number(a.stock_actuel ?? 0) / Math.max(Number(a.seuil_alerte ?? 1), 1);
      const rb = Number(b.stock_actuel ?? 0) / Math.max(Number(b.seuil_alerte ?? 1), 1);
      return ra - rb;
    });

    // Top 5 affaires par valeur consommée (vue consommation_par_affaire)
    const { data: conso } = await supabase
      .from("consommation_par_affaire")
      .select("affaire_id, valeur_consommee_ht");
    const parAffaire = new Map<string, number>();
    for (const c of (conso ?? []) as {
      affaire_id: string | null;
      valeur_consommee_ht: number | null;
    }[]) {
      if (!c.affaire_id) continue;
      parAffaire.set(
        c.affaire_id,
        (parAffaire.get(c.affaire_id) ?? 0) + Number(c.valeur_consommee_ht ?? 0),
      );
    }
    const topIds = Array.from(parAffaire.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let topList: TopAffaire[] = [];
    if (topIds.length > 0) {
      const { data: aff5 } = await supabase
        .from("affaires")
        .select("id, code_chantier, client")
        .in(
          "id",
          topIds.map(([id]) => id),
        );
      const map = new Map((aff5 ?? []).map((a) => [a.id, a]));
      topList = topIds
        .map(([id, valeur]) => {
          const a = map.get(id);
          if (!a) return null;
          return { id, code_chantier: a.code_chantier, client: a.client, valeur };
        })
        .filter((x): x is TopAffaire => x !== null);
    }

    setKpis({
      affaires_en_cours: aff.count ?? 0,
      bdc_en_attente: bdc.count ?? 0,
      stock_bas: stockBas,
      valeur_stock: valeur,
    });
    setAlertes(alertesList.slice(0, 5));
    setTopAffaires(topList);
    setMouvements((mvtData.data ?? []) as unknown as MouvementRecent[]);
    // Onboarding masqué dès qu'il y a au moins une matière OU un mouvement
    const { count: nbMatieres } = await supabase
      .from("matieres")
      .select("id", { count: "exact", head: true });
    setHasData((nbMatieres ?? 0) > 0 || (mvtData.data?.length ?? 0) > 0);
    setLoadingData(false);
  }

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  // Mise à jour temps réel : recharge sur nouveau mouvement
  useStockRealtime(
    () => {
      void loadDashboard();
    },
    isAdmin && !authLoading,
    600,
  );

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
      {/* Hero éditorial — style Setup Paris */}
      <header className="relative pt-4 md:pt-8">
        <p className="section-marker mb-6 flex items-center gap-3">
          <span>— 01</span>
          <span className="h-px flex-1 max-w-[120px] bg-primary/40" />
          <span className="text-muted-foreground">Setup Paris · Stock atelier</span>
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-[88px] tracking-tight max-w-4xl">
          Pilotage du{" "}
          <span className="text-muted-foreground/60">stock panneaux</span>
          <br />
          en temps réel.
        </h1>
        <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground">
          Suivi continu des affaires, bons de commande et mouvements — toutes les données de
          l'atelier en un coup d'œil.
        </p>
      </header>

      {/* KPIs — grid éditorial avec gros chiffres */}
      <section>
        <p className="section-marker mb-6">— 02 · Indicateurs</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {cards.map((kpi, idx) => (
            <div key={kpi.label} className="bg-card p-5 md:p-6 relative group">
              <span className="absolute top-3 right-4 font-mono text-[10px] text-muted-foreground tracking-wider">
                0{idx + 1}
              </span>
              <p className="eyebrow mb-3">{kpi.label}</p>
              <div className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[color:var(--color-heading)]">
                {kpi.value === null ? "—" : kpi.format(kpi.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{kpi.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="section-marker mb-6">— 03 · Consommation</p>
        <DashboardConsoChart />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertes seuil bas */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="section-marker">— 04</span>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="font-display text-lg font-semibold tracking-tight">Alertes seuil bas</h2>
            </div>
            <Link to="/inventaire" className="link-arrow text-xs">
              Voir tout l'inventaire →
            </Link>
          </div>
          {loadingData ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : alertes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun panneau sous son seuil. Tout va bien.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {alertes.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">
                      {a.matiere_code ?? "—"}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {a.matiere_libelle} · {a.longueur_mm}×{a.largeur_mm}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-warning font-medium">
                      {formatNumber(Number(a.stock_actuel ?? 0), 2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      seuil {formatNumber(Number(a.seuil_alerte ?? 0), 0)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top 5 affaires par consommation */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="section-marker">— 05</span>
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold tracking-tight">Top affaires</h2>
            </div>
            <Link to="/affaires" className="link-arrow text-xs">
              Voir toutes les affaires →
            </Link>
          </div>
          {loadingData ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : topAffaires.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune consommation enregistrée.</p>
          ) : (
            <ul className="divide-y divide-border">
              {topAffaires.map((a, idx) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-4">{idx + 1}</span>
                    <Link
                      to="/affaires/$code"
                      params={{ code: a.code_chantier }}
                      className="min-w-0 flex flex-col"
                    >
                      <span className="font-medium truncate">{a.code_chantier}</span>
                      <span className="text-xs text-muted-foreground truncate">{a.client}</span>
                    </Link>
                  </div>
                  <div className="shrink-0 text-right font-medium">{formatEuro(a.valeur)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Mouvements récents */}
      <section>
        <RecentMouvementsCard
          mouvements={mouvements}
          loading={loadingData}
          onCreated={() => void loadDashboard()}
        />
      </section>

      {hasData === false && (
        <section className="space-y-8">
          <div className="space-y-3">
            <p className="section-marker">— 07 · Modules</p>
            <h2 className="text-3xl md:text-4xl tracking-tight">Pour démarrer</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Ces 4 modules constituent le cœur de l'application. Commence par le catalogue pour
              référencer tes matières et tes panneaux.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            {sections.map((s) => (
              <Link
                key={s.num}
                to={s.to}
                className="relative bg-card p-8 hover:bg-muted/40 transition-all cursor-pointer group overflow-hidden"
              >
                <span className="editorial-number absolute -top-2 -right-3 text-[120px] select-none pointer-events-none">
                  {s.num}
                </span>
                <div className="relative">
                  <p className="section-marker mb-3">— {s.num}</p>
                  <h3 className="font-display text-2xl md:text-3xl tracking-tight flex items-center gap-2 mb-2">
                    {s.title}
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
