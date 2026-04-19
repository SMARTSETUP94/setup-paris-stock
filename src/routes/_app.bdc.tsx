import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/bdc")({
  head: () => ({ meta: [{ title: "Bons de commande — Setup Stock" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Bons de commande" title="Bons de commande" description="Module à venir." />
      <Card className="p-12 text-center text-muted-foreground">Bientôt disponible.</Card>
    </div>
  ),
});
