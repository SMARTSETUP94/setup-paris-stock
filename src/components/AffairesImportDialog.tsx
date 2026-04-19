import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { parseFile } from "@/lib/import-parsers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeForMatch, STATUTS, type StatutAffaire } from "@/lib/affaires";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type ParsedRow = {
  code_chantier: string;
  numero: string | null;
  nom: string;
  client: string;
  adresse: string | null;
  charge_affaires_libre: string | null;
  charge_affaires_id: string | null;
  charge_match_label: string | null; // pour preview : "Gabin Chaussegros (matché)" ou null
  code_interne: string | null;
  statut: StatutAffaire;
};

type Row = {
  index: number;
  raw: Record<string, string>;
  data: ParsedRow | null;
  errors: string[];
  status: "new" | "duplicate" | "error";
  action: "create" | "skip" | "overwrite";
};

// Colonnes attendues (libellés humains tels qu'exportés depuis Excel)
const EXPECTED = ["code affaire", "libelle", "client"];
const VALID_STATUTS: StatutAffaire[] = STATUTS.map((s) => s.value);

/**
 * Normalise un en-tête de colonne pour matching tolérant :
 * minuscule, sans accents, sans ponctuation, espaces compactés.
 * "Chargé(e) d'affaires" → "charge e d affaires"
 */
function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mappe une clé brute du CSV vers un champ interne reconnu.
 * Tolère les variantes : "Code affaire" / "code_chantier" / "code chantier".
 */
function canonicalKey(rawKey: string): string {
  const k = normalizeHeader(rawKey);
  if (k === "code affaire" || k === "code chantier" || k === "code_chantier")
    return "code_chantier";
  if (k === "libelle" || k === "nom" || k === "intitule") return "nom";
  if (k === "client") return "client";
  if (k.startsWith("charge")) return "charge_affaires"; // "charge e d affaires", "charge d affaires", "charge affaires"
  if (k === "adresse") return "adresse";
  if (k === "numero" || k === "n" || k === "num") return "numero";
  if (k === "code interne" || k === "code_interne") return "code_interne";
  if (k === "statut" || k === "status" || k === "etat") return "statut";
  return k;
}

function parseStatut(v: string | undefined): StatutAffaire {
  const norm = (v ?? "").trim().toLowerCase();
  if ((VALID_STATUTS as string[]).includes(norm)) return norm as StatutAffaire;
  return "en_cours";
}

export function AffairesImportDialog({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setRows([]);
    setParsing(false);
    setImporting(false);
  }

  async function handleFile(f: File) {
    setFile(f);
    setParsing(true);
    setRows([]);
    try {
      const parsed = await parseFile(f);
      if (parsed.length === 0) {
        toast.error("Fichier vide");
        setParsing(false);
        return;
      }
      const headers = Object.keys(parsed[0]).map(canonicalKey);
      const missing = EXPECTED.filter((c) => {
        // EXPECTED contient les libellés "humains" : on cherche la version canonique correspondante
        const canonical = canonicalKey(c);
        return !headers.includes(canonical);
      });
      if (missing.length) {
        toast.error("Colonnes manquantes", { description: missing.join(", ") });
        setParsing(false);
        return;
      }

      // Charger profils admin pour matching fuzzy
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nom_complet, email")
        .eq("role", "admin")
        .eq("actif", true);
      const profiles = (
        (profilesData ?? []) as { id: string; nom_complet: string | null; email: string }[]
      ).map((p) => ({
        id: p.id,
        label: p.nom_complet ?? p.email,
        norm: normalizeForMatch(p.nom_complet ?? p.email),
      }));

      // Charger code_chantier existants pour détecter doublons
      const { data: existingData } = await supabase.from("affaires").select("code_chantier");
      const existingCodes = new Set(
        ((existingData ?? []) as { code_chantier: string }[]).map((r) => r.code_chantier),
      );

      // Normaliser les clés (insensible casse)
      const validated: Row[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const rawOriginal = parsed[i];
        const raw: Record<string, string> = {};
        for (const k of Object.keys(rawOriginal)) {
          raw[canonicalKey(k)] = String(rawOriginal[k] ?? "").trim();
        }

        const errors: string[] = [];
        const code_chantier = raw["code_chantier"];
        const nom = raw["nom"];
        const client = raw["client"];

        if (!code_chantier) errors.push("code_chantier vide");
        if (!nom) errors.push("nom vide");
        if (!client) errors.push("client vide");

        // Matching fuzzy chargé d'affaires
        const chargeRaw = raw["charge_affaires"] ?? "";
        let charge_affaires_id: string | null = null;
        let charge_affaires_libre: string | null = null;
        let charge_match_label: string | null = null;
        if (chargeRaw) {
          const chargeNorm = normalizeForMatch(chargeRaw);
          // Match exact tokens (chaque mot du nom doit apparaître dans le profil ou inversement)
          const tokens = chargeNorm.split(" ").filter((t) => t.length >= 2);
          let best: { id: string; label: string; score: number } | null = null;
          for (const p of profiles) {
            const pTokens = p.norm.split(" ").filter((t) => t.length >= 2);
            const matches = tokens.filter((t) =>
              pTokens.some((pt) => pt.includes(t) || t.includes(pt)),
            );
            const score = matches.length;
            if (score >= Math.min(2, tokens.length) && (!best || score > best.score)) {
              best = { id: p.id, label: p.label, score };
            }
          }
          if (best) {
            charge_affaires_id = best.id;
            charge_match_label = best.label;
          } else {
            charge_affaires_libre = chargeRaw;
          }
        }

        const numeroRaw = raw["numero"];
        const numeroExtracted = numeroRaw || (code_chantier.match(/^(\d{3,5})/)?.[1] ?? null);

        const data: ParsedRow | null =
          errors.length === 0
            ? {
                code_chantier,
                numero: numeroExtracted,
                nom,
                client,
                adresse: raw["adresse"] || null,
                charge_affaires_id,
                charge_affaires_libre,
                charge_match_label,
                code_interne: raw["code_interne"] || null,
                statut: parseStatut(raw["statut"]),
              }
            : null;

        const isDuplicate = data ? existingCodes.has(data.code_chantier) : false;

        validated.push({
          index: i,
          raw,
          data,
          errors,
          status: errors.length > 0 ? "error" : isDuplicate ? "duplicate" : "new",
          action: errors.length > 0 ? "skip" : isDuplicate ? "skip" : "create",
        });
      }
      setRows(validated);
    } catch (e) {
      toast.error("Erreur de parsing", { description: (e as Error).message });
    } finally {
      setParsing(false);
    }
  }

  function setRowAction(index: number, action: Row["action"]) {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, action } : r)));
  }

  async function handleImport() {
    setImporting(true);
    try {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      const toCreate: ParsedRow[] = [];
      const toOverwrite: ParsedRow[] = [];
      for (const r of rows) {
        if (!r.data || r.action === "skip") {
          skipped++;
          continue;
        }
        if (r.action === "create") toCreate.push(r.data);
        else if (r.action === "overwrite") toOverwrite.push(r.data);
      }

      // Inserts en batch
      if (toCreate.length > 0) {
        const payload = toCreate.map((d) => ({
          code_chantier: d.code_chantier,
          nom: d.nom,
          client: d.client,
          adresse: d.adresse,
          charge_affaires_id: d.charge_affaires_id,
          charge_affaires_libre: d.charge_affaires_libre,
          code_interne: d.code_interne,
          statut: d.statut,
        }));
        const { error, count } = await supabase
          .from("affaires")
          .insert(payload, { count: "exact" });
        if (error) {
          errors += toCreate.length;
          toast.error("Échec insertions", { description: error.message });
        } else {
          inserted += count ?? toCreate.length;
        }
      }

      // Overwrites (un par un sur code_chantier)
      for (const d of toOverwrite) {
        const { error } = await supabase
          .from("affaires")
          .update({
            nom: d.nom,
            client: d.client,
            adresse: d.adresse,
            charge_affaires_id: d.charge_affaires_id,
            charge_affaires_libre: d.charge_affaires_libre,
            code_interne: d.code_interne,
            statut: d.statut,
          })
          .eq("code_chantier", d.code_chantier);
        if (error) errors++;
        else updated++;
      }

      toast.success("Import terminé", {
        description: `${inserted} créées · ${updated} mises à jour · ${skipped} ignorées${errors ? ` · ${errors} erreurs` : ""}`,
      });
      onImported?.();
      reset();
      onClose();
    } catch (e) {
      toast.error("Échec de l'import", { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  const counts = useMemo(
    () => ({
      new: rows.filter((r) => r.status === "new").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      error: rows.filter((r) => r.status === "error").length,
      unmatched: rows.filter((r) => r.data?.charge_affaires_libre).length,
    }),
    [rows],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des affaires (CSV)</DialogTitle>
          <DialogDescription>
            CSV / XLSX — séparateur virgule ou point-virgule auto-détecté. Colonnes attendues :{" "}
            <span className="font-mono text-xs">Code affaire, Libelle, Client</span> (obligatoires)
            ·{" "}
            <span className="font-mono text-xs">
              Chargé(e) d'affaires, adresse, code_interne, statut
            </span>{" "}
            (optionnelles). Les en-têtes sont reconnus en majuscules/minuscules, avec ou sans
            accents.
          </DialogDescription>
        </DialogHeader>

        {!file && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            )}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Glissez un fichier CSV ou XLSX</p>
            <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
        )}

        {parsing && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyse du fichier…
          </div>
        )}

        {file && rows.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={reset} className="h-6 px-2">
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" /> {counts.new} nouvelles
                </span>
                <span className="inline-flex items-center gap-1 text-warning">
                  {counts.duplicate} doublons
                </span>
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {counts.error} erreurs
                </span>
                {counts.unmatched > 0 && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-3 w-3" /> {counts.unmatched} chargés non matchés
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-12">#</th>
                    <th className="text-left px-3 py-2 font-medium">Code chantier</th>
                    <th className="text-left px-3 py-2 font-medium">Nom</th>
                    <th className="text-left px-3 py-2 font-medium">Client</th>
                    <th className="text-left px-3 py-2 font-medium">Chargé d'affaires</th>
                    <th className="text-left px-3 py-2 font-medium">Statut</th>
                    <th className="text-left px-3 py-2 font-medium">État</th>
                    <th className="text-left px-3 py-2 font-medium w-32">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.index}
                      className={cn(
                        "border-t border-border",
                        r.status === "error" && "bg-destructive/5",
                        r.status === "duplicate" && "bg-warning/5",
                        r.status === "new" && "bg-success/5",
                      )}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{r.index + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.data?.code_chantier ?? r.raw["code_chantier"]}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[200px]">
                        {r.data?.nom ?? r.raw["nom"]}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[150px]">
                        {r.data?.client ?? r.raw["client"]}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[180px]">
                        {r.data?.charge_match_label ? (
                          <span className="text-success">{r.data.charge_match_label}</span>
                        ) : r.data?.charge_affaires_libre ? (
                          <span className="inline-flex items-center gap-1 text-warning text-xs">
                            <AlertTriangle className="h-3 w-3" /> {r.data.charge_affaires_libre}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.data?.statut ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.status === "error" && (
                          <span className="text-destructive text-xs">{r.errors.join(" · ")}</span>
                        )}
                        {r.status === "duplicate" && (
                          <span className="text-warning text-xs">Existe déjà</span>
                        )}
                        {r.status === "new" && (
                          <span className="text-success text-xs">Nouvelle</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.action}
                          disabled={r.status === "error"}
                          onChange={(e) => setRowAction(r.index, e.target.value as Row["action"])}
                          className="text-xs border border-border rounded px-2 py-1 bg-card disabled:opacity-50"
                        >
                          {r.status === "new" && <option value="create">Créer</option>}
                          {r.status === "duplicate" && <option value="overwrite">Écraser</option>}
                          <option value="skip">Ignorer</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onClose();
                }}
                disabled={importing}
              >
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || rows.every((r) => r.action === "skip")}
              >
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Valider l'import
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
