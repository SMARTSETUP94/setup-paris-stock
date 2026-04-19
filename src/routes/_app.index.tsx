import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Setup Stock" },
      { name: "description", content: "Vue d'ensemble du stock, des affaires et des bons de commande." },
    ],
  }),
  component: DashboardPage,
});

const kpis = [
  { label: "Affaires en cours", value: "—", hint: "Toutes affaires actives" },
  { label: "BDC en attente", value: "—", hint: "À traiter ou valider" },
  { label: "Stock bas", value: "—", hint: "Sous le seuil d'alerte" },
  { label: "Valeur stock estimée", value: "—", hint: "Sur prix d'achat HT" },
];

const sections = [
  { num: "01", title: "Catalogue", desc: "Référentiel matières et panneaux." },
  { num: "02", title: "Affaires", desc: "Suivi par numéro et accès tiers." },
  { num: "03", title: "Bons de commande", desc: "Import PDF et extraction OCR." },
  { num: "04", title: "Mouvements", desc: "Entrées, sorties et corrections." },
];

function DashboardPage() {
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
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-normal normal-case">
                <span className="font-sans">{kpi.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="font-sans text-3xl md:text-4xl font-semibold text-[color:var(--color-heading)]">
                {kpi.value}
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
          <a className="link-arrow hidden md:inline-flex" href="#">
            Voir tout →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Card key={s.num} className="p-6">
              <div className="flex items-start gap-6">
                <span className="font-display text-3xl text-muted-foreground/70">{s.num}</span>
                <div className="space-y-1">
                  <h3 className="text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
