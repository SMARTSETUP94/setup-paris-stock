import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText, AlertTriangle, Wallet } from "lucide-react";

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
  { label: "Affaires en cours", value: "—", icon: Briefcase, accent: "text-primary" },
  { label: "BDC en attente", value: "—", icon: FileText, accent: "text-amber-600" },
  { label: "Stock bas", value: "—", icon: AlertTriangle, accent: "text-destructive" },
  { label: "Valeur stock estimée", value: "—", icon: Wallet, accent: "text-emerald-600" },
];

function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble de votre stock et de votre activité.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${kpi.accent}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bienvenue</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Les modules <strong>Catalogue</strong>, <strong>Affaires</strong>,{" "}
            <strong>Bons de commande</strong> et <strong>Mouvements</strong> seront ajoutés
            progressivement.
          </p>
          <p>Cette première version pose les fondations : authentification, base de données et structure d'accès.</p>
        </CardContent>
      </Card>
    </div>
  );
}
