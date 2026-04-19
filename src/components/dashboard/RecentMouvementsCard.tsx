import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TypeMouvementBadge } from "@/components/TypeMouvementBadge";
import { MouvementDialog } from "@/components/MouvementDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber } from "@/lib/familles";
import { formatDateTimeFr } from "@/lib/affaires";

export type MouvementRecent = {
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

type Props = {
  mouvements: MouvementRecent[];
  loading: boolean;
  onCreated?: () => void;
};

export function RecentMouvementsCard({ mouvements, loading, onCreated }: Props) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [openMode, setOpenMode] = useState<"entree" | "sortie" | null>(null);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="section-marker">— 06</span>
          <h2 className="font-display text-lg font-semibold tracking-tight">Mouvements récents</h2>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setOpenMode("entree")}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nouveau mouvement
            </Button>
          )}
          <Link to="/mouvements" className="link-arrow text-xs">
            Voir tous les mouvements →
          </Link>
        </div>
      </div>
      {loading ? (
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
                      ? "text-destructive font-medium"
                      : "text-success font-medium"
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

      <MouvementDialog
        open={openMode !== null}
        onOpenChange={(v) => {
          if (!v) setOpenMode(null);
        }}
        mode={openMode ?? "entree"}
        isAdmin={isAdmin}
        userId={user?.id ?? null}
        onCreated={() => onCreated?.()}
      />
    </Card>
  );
}
