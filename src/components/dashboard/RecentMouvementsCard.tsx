import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { TypeMouvementBadge } from "@/components/TypeMouvementBadge";
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
};

export function RecentMouvementsCard({ mouvements, loading }: Props) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="section-marker">— 06</span>
          <h2 className="font-display text-lg font-semibold tracking-tight">Mouvements récents</h2>
        </div>
        <Link to="/mouvements" className="link-arrow text-xs">
          Voir tous les mouvements →
        </Link>
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
    </Card>
  );
}
