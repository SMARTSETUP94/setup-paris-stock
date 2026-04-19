/**
 * Sélecteur cascade Matière → Format → Épaisseur pour la page publique /scan.
 * Une fois l'épaisseur choisie, on navigue vers /scan/$panneauId pour saisir la sortie.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  listCataloguePublic,
  type CascadeMatiere,
  type CascadePanneau,
} from "@/lib/scan.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Layers } from "lucide-react";

export function CascadeSelector() {
  const navigate = useNavigate();
  const fetchFn = useServerFn(listCataloguePublic);

  const [loading, setLoading] = useState(true);
  const [matieres, setMatieres] = useState<CascadeMatiere[]>([]);
  const [panneaux, setPanneaux] = useState<CascadePanneau[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [matiereSearch, setMatiereSearch] = useState("");
  const [matiereId, setMatiereId] = useState<string>("");
  const [formatKey, setFormatKey] = useState<string>(""); // "longueur×largeur"
  const [epaisseur, setEpaisseur] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await fetchFn();
        if (!mounted) return;
        setMatieres(res.matieres);
        setPanneaux(res.panneaux);
      } catch (e) {
        setError((e instanceof Error ? e.message : null) ?? "Erreur de chargement");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchFn]);

  // Filtrage matières par texte
  const matieresFiltrees = useMemo(() => {
    const q = matiereSearch.trim().toLowerCase();
    if (!q) return matieres;
    return matieres.filter(
      (m) => m.libelle.toLowerCase().includes(q) || m.code.toLowerCase().includes(q),
    );
  }, [matieres, matiereSearch]);

  // Formats disponibles pour la matière sélectionnée
  const formats = useMemo(() => {
    if (!matiereId) return [] as { key: string; longueur: number; largeur: number }[];
    const seen = new Map<string, { key: string; longueur: number; largeur: number }>();
    panneaux
      .filter((p) => p.matiere_id === matiereId)
      .forEach((p) => {
        const key = `${p.longueur_mm}x${p.largeur_mm}`;
        if (!seen.has(key)) seen.set(key, { key, longueur: p.longueur_mm, largeur: p.largeur_mm });
      });
    return Array.from(seen.values()).sort(
      (a, b) => b.longueur * b.largeur - a.longueur * a.largeur,
    );
  }, [panneaux, matiereId]);

  // Épaisseurs pour matière + format
  const epaisseurs = useMemo(() => {
    if (!matiereId || !formatKey) return [] as { value: string; panneauId: string }[];
    const [lStr, wStr] = formatKey.split("x");
    const l = Number(lStr);
    const w = Number(wStr);
    return panneaux
      .filter((p) => p.matiere_id === matiereId && p.longueur_mm === l && p.largeur_mm === w)
      .map((p) => ({ value: String(p.epaisseur_mm), panneauId: p.id }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [panneaux, matiereId, formatKey]);

  // Reset des étapes en cascade
  function handleMatiereChange(id: string) {
    setMatiereId(id);
    setFormatKey("");
    setEpaisseur("");
  }
  function handleFormatChange(key: string) {
    setFormatKey(key);
    setEpaisseur("");
  }
  function handleEpaisseurChange(value: string) {
    setEpaisseur(value);
    const target = epaisseurs.find((e) => e.value === value);
    if (target) {
      navigate({ to: "/scan/$panneauId", params: { panneauId: target.panneauId } });
    }
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-destructive bg-destructive/5 text-sm text-destructive">
        {error}
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4 text-muted-foreground" />
        Sélection guidée
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cascade-matiere">Matière *</Label>
        <Input
          placeholder="Filtrer (ex. MDF, médium…)"
          value={matiereSearch}
          onChange={(e) => setMatiereSearch(e.target.value)}
          className="text-sm"
        />
        <Select value={matiereId} onValueChange={handleMatiereChange}>
          <SelectTrigger id="cascade-matiere" className="mt-1">
            <SelectValue placeholder={`Choisir parmi ${matieresFiltrees.length} matières…`} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {matieresFiltrees.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">{m.code}</span>
                {m.libelle}
              </SelectItem>
            ))}
            {matieresFiltrees.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">Aucune matière</div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cascade-format">Format *</Label>
        <Select value={formatKey} onValueChange={handleFormatChange} disabled={!matiereId}>
          <SelectTrigger id="cascade-format">
            <SelectValue
              placeholder={matiereId ? "Choisir un format…" : "Sélectionne d'abord une matière"}
            />
          </SelectTrigger>
          <SelectContent>
            {formats.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.longueur} × {f.largeur} mm
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cascade-epaisseur">Épaisseur *</Label>
        <Select value={epaisseur} onValueChange={handleEpaisseurChange} disabled={!formatKey}>
          <SelectTrigger id="cascade-epaisseur">
            <SelectValue
              placeholder={formatKey ? "Choisir une épaisseur…" : "Sélectionne d'abord un format"}
            />
          </SelectTrigger>
          <SelectContent>
            {epaisseurs.map((e) => (
              <SelectItem key={e.panneauId} value={e.value}>
                {e.value} mm
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground pt-1">
          Dès l'épaisseur choisie, tu accèdes à l'écran de sortie.
        </p>
      </div>
    </Card>
  );
}
