import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStockRealtime } from "@/hooks/useStockRealtime";
import { formatEuro, formatNumber } from "@/lib/familles";
import { formatDateTimeFr } from "@/lib/affaires";
import { TypeMouvementBadge } from "@/components/TypeMouvementBadge";
import { DashboardConsoChart } from "@/components/dashboard/DashboardConsoChart";

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

type MouvementRecent = {
  id: string;
  type: string;
  quantite: number;
  created_at: string;
  panneau: {
    longueur_mm: number;
    largeur_mm: number;
    matiere: { code: string; libelle: string } | null;
  } | null;
  affaire: { code_chantier: string } | null;
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
        .limit(10),
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
      parAffaire.set(c.affaire_id, (parAffaire.get(c.affaire_id) ?? 0) + Number(c.valeur_consommee_ht ?? 0));
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
    <div className="max-w-6xl space-y-16 md:space-y-20">
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

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertes seuil bas */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-base font-semibold">Alertes seuil bas</h2>
            </div>
            <Link to="/inventaire" className="link-arrow text-xs">
              Voir l'inventaire →
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
                    <div className="text-amber-700 font-medium">
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
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Top affaires consommatrices</h2>
            </div>
            <Link to="/affaires" className="link-arrow text-xs">
              Voir toutes →
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
                    <span className="font-mono text-xs text-muted-foreground w-4">
                      {idx + 1}
                    </span>
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
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Mouvements récents</h2>
            <Link to="/mouvements" className="link-arrow text-xs">
              Tout l'historique →
            </Link>
          </div>
          {loadingData ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : mouvements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="divide-y divide-border">
              {mouvements.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex items-center gap-3">
                    <TypeMouvementBadge value={m.type} />
                    <div className="min-w-0">
                      <div className="truncate">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted mr-1.5">
                          {m.panneau?.matiere?.code ?? "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {m.panneau?.matiere?.libelle} · {m.panneau?.longueur_mm}×
                          {m.panneau?.largeur_mm}
                        </span>
                      </div>
                      {m.affaire?.code_chantier ? (
                        <div className="text-xs text-muted-foreground truncate">
                          Affaire {m.affaire.code_chantier}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={
                        Number(m.quantite) < 0
                          ? "text-rose-700 font-medium"
                          : "text-emerald-700 font-medium"
                      }
                    >
                      {Number(m.quantite) > 0 ? "+" : ""}
                      {formatNumber(Number(m.quantite), 2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTimeFr(m.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
                    <h3 className="text-lg flex items-center gap-2">
                      {s.title}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </h3>
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
