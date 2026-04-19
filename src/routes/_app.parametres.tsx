import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Setup Stock" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Paramètres" title="Paramètres" description="Module à venir." />
      <Card className="p-12 text-center text-muted-foreground">Bientôt disponible.</Card>
    </div>
  ),
});
