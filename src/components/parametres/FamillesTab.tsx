import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFamilles, type FamilleMeta } from "@/hooks/useFamilles";
import type { Famille } from "@/lib/familles";

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

type Draft = { label: string; couleur: string };

export function FamillesTab() {
  const { familles, loading, refresh } = useFamilles();
  const [drafts, setDrafts] = useState<Record<Famille, Draft>>({} as Record<Famille, Draft>);
  const [savingKey, setSavingKey] = useState<Famille | null>(null);

  useEffect(() => {
    if (familles.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const f of familles) {
        if (!next[f.value]) {
          next[f.value] = { label: f.label, couleur: f.color };
        }
      }
      return next;
    });
  }, [familles]);

  function setDraft(value: Famille, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [value]: { ...prev[value], ...patch } }));
  }

  function isDirty(f: FamilleMeta) {
    const d = drafts[f.value];
    if (!d) return false;
    return d.label.trim() !== f.label || d.couleur.toLowerCase() !== f.color.toLowerCase();
  }

  async function save(f: FamilleMeta) {
    const d = drafts[f.value];
    if (!d) return;
    const label = d.label.trim();
    const couleur = d.couleur.trim();
    if (label.length === 0) {
      toast.error("Le libellé ne peut pas être vide");
      return;
    }
    if (!HEX_RE.test(couleur)) {
      toast.error("Couleur invalide", { description: "Format attendu : #RRGGBB" });
      return;
    }

    setSavingKey(f.value);
    try {
      // Si label = défaut ET couleur = défaut → on supprime l'override
      const labelIsDefault = label === f.defaultLabel;
      const couleurIsDefault = couleur.toLowerCase() === f.defaultColor.toLowerCase();

      if (labelIsDefault && couleurIsDefault) {
        const { error } = await supabase.from("familles_overrides").delete().eq("famille", f.value);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("familles_overrides").upsert(
          {
            famille: f.value,
            label: labelIsDefault ? null : label,
            couleur: couleurIsDefault ? null : couleur,
          },
          { onConflict: "famille" },
        );
        if (error) throw error;
      }
      toast.success("Famille mise à jour");
      void refresh();
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function reset(f: FamilleMeta) {
    setSavingKey(f.value);
    try {
      const { error } = await supabase.from("familles_overrides").delete().eq("famille", f.value);
      if (error) throw error;
      setDrafts((prev) => ({
        ...prev,
        [f.value]: { label: f.defaultLabel, couleur: f.defaultColor },
      }));
      toast.success("Personnalisation réinitialisée");
      void refresh();
    } catch (e) {
      toast.error("Action impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Les familles techniques sont fixes et utilisées partout dans l'application. Vous pouvez
          ici personnaliser uniquement leur <strong>libellé affiché</strong> et leur{" "}
          <strong>couleur</strong>. Le code interne (bois, pvc, …) reste inchangé.
        </p>
      </Card>

      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {familles.map((f) => {
              const d = drafts[f.value] ?? { label: f.label, couleur: f.color };
              const dirty = isDirty(f);
              const saving = savingKey === f.value;
              return (
                <li key={f.value} className="px-4 py-4">
                  <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <span
                        className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium shrink-0"
                        style={{
                          backgroundColor: `${d.couleur}1A`,
                          color: d.couleur,
                        }}
                      >
                        {d.label || "—"}
                      </span>
                      <code className="text-[10px] text-muted-foreground">{f.value}</code>
                    </div>

                    <div className="flex-1 min-w-[160px] space-y-1">
                      <Label htmlFor={`label-${f.value}`} className="text-xs">
                        Libellé
                      </Label>
                      <Input
                        id={`label-${f.value}`}
                        value={d.label}
                        onChange={(e) => setDraft(f.value, { label: e.target.value })}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`color-${f.value}`} className="text-xs">
                        Couleur
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          id={`color-${f.value}`}
                          value={d.couleur}
                          onChange={(e) => setDraft(f.value, { couleur: e.target.value })}
                          className="h-9 w-12 p-1 cursor-pointer"
                        />
                        <Input
                          value={d.couleur}
                          onChange={(e) => setDraft(f.value, { couleur: e.target.value })}
                          className="h-9 w-24 font-mono text-xs uppercase"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div className="flex items-end gap-2 pt-5">
                      {f.isOverridden && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => reset(f)}
                          disabled={saving}
                          title="Réinitialiser aux valeurs par défaut"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => save(f)}
                        disabled={!dirty || saving}
                      >
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
