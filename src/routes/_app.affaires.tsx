import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/affaires")({
  head: () => ({ meta: [{ title: "Affaires — Setup Stock" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Affaires" title="Affaires" description="Module à venir." />
      <Card className="p-12 text-center text-muted-foreground">Bientôt disponible.</Card>
    </div>
  ),
});
