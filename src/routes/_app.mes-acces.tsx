/**
 * ============================================================
 * ROUTE TIERS — /mes-acces
 * ============================================================
 * Page d'accueil pour les utilisateurs avec rôle "tiers".
 * Liste les affaires auxquelles ils ont été invités via affaire_acces.
 * Les permissions et l'expiration sont affichées pour chaque accès.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Briefcase, Eye, KeyRound, ScanLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/mes-acces")({
  head: () => ({
    meta: [
      { title: "Mes accès — Setup Stock" },
      { name: "description", content: "Affaires auxquelles vous avez accès." },
    ],
  }),
  component: MesAccesPage,
});

type AccesRow = {
  id: string;
  affaire_id: string;
  permissions: "lecture" | "sortie" | "entree_sortie";
  expire_le: string;
  affaire: {
    code_chantier: string;
    nom: string;
    client: string;
    statut: string;
  } | null;
};

const PERMISSIONS_LABEL: Record<AccesRow["permissions"], { label: string; tone: string }> = {
  lecture: { label: "Lecture seule", tone: "bg-muted text-muted-foreground" },
  sortie: { label: "Sorties autorisées", tone: "bg-warning/10 text-warning" },
  entree_sortie: { label: "Entrées + sorties", tone: "bg-success/10 text-success" },
};

function MesAccesPage() {
  const { profile, loading: authLoading } = useAuth();
  const [acces, setAcces] = useState<AccesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !profile) return;
    let mounted = true;
    void (async () => {
      const { data } = await supabase
        .from("affaire_acces")
        .select(
          "id, affaire_id, permissions, expire_le, affaire:affaires(code_chantier, nom, client, statut)",
        )
        .eq("tiers_profile_id", profile.id)
        .gt("expire_le", new Date().toISOString())
        .order("expire_le", { ascending: true });
      if (!mounted) return;
      setAcces((data as unknown as AccesRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [profile, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        sectionNumber="01"
        eyebrow="Mes accès"
        title={`Bienvenue${profile?.nom_complet ? `, ${profile.nom_complet.split(" ")[0]}` : ""}.`}
        description="Voici les affaires auxquelles vous avez été invité(e). Cliquez pour consulter le détail ou scanner un panneau."
        actions={
          <Button variant="outline" asChild>
            <Link to="/scan">
              <ScanLine className="h-4 w-4" /> Scanner un panneau
            </Link>
          </Button>
        }
      />

      {acces.length === 0 ? (
        <Card className="p-10 text-center">
          <KeyRound className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">Aucun accès actif</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Aucune affaire ne vous est encore partagée. Contactez votre interlocuteur Setup Paris
            pour recevoir une invitation.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {acces.map((a, idx) => {
            const perm = PERMISSIONS_LABEL[a.permissions];
            const expireDate = new Date(a.expire_le);
            const joursRestants = Math.max(
              0,
              Math.ceil((expireDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            );
            const expireSoon = joursRestants <= 7;
            return (
              <Link
                key={a.id}
                to="/affaires/$code"
                params={{ code: a.affaire?.code_chantier ?? "" }}
                disabled={!a.affaire}
                className="relative bg-card p-6 hover:bg-muted/40 transition-all group overflow-hidden min-h-[180px] flex flex-col justify-between"
              >
                <span className="editorial-number absolute -top-4 -right-2 text-[100px] select-none pointer-events-none">
                  0{idx + 1}
                </span>
                <div className="relative">
                  <p className="font-mono text-[10px] text-primary tracking-wider mb-2">
                    — 0{idx + 1}
                  </p>
                  <h3 className="font-display text-xl tracking-tight font-semibold mb-1 truncate">
                    {a.affaire?.nom ?? "Affaire indisponible"}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {a.affaire?.client ?? "—"}
                  </p>
                </div>
                <div className="relative flex items-end justify-between mt-4 gap-2">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-muted truncate max-w-[160px]">
                      {a.affaire?.code_chantier ?? "—"}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${perm.tone}`}
                    >
                      <Eye className="inline h-3 w-3 mr-1" />
                      {perm.label}
                    </span>
                    <span
                      className={`text-[10px] ${expireSoon ? "text-warning font-medium" : "text-muted-foreground"}`}
                    >
                      Expire dans {joursRestants}{" "}
                      {joursRestants > 1 ? "jours" : joursRestants === 0 ? "jour" : "jour"}
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {acces.length} accès actif{acces.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
