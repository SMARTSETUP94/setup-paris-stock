import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseFile } from "@/lib/import-parsers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ImportRow<T> {
  index: number;
  raw: Record<string, string>;
  data: T | null;
  errors: string[];
  status: "new" | "duplicate" | "error";
  action: "create" | "skip" | "overwrite";
}

interface ImportDialogProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  expectedColumns: string[];
  validateRow: (raw: Record<string, string>, index: number) => Promise<{ data: T | null; errors: string[]; isDuplicate: boolean }>;
  importRows: (rows: ImportRow<T>[]) => Promise<{ inserted: number; updated: number; skipped: number; errors: number }>;
  columnsPreview: { key: string; label: string; render?: (data: T) => React.ReactNode }[];
}

export function ImportDialog<T>({
  open,
  onClose,
  title,
  description,
  expectedColumns,
  validateRow,
  importRows,
  columnsPreview,
}: ImportDialogProps<T>) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ImportRow<T>[]>([]);
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
      const headers = Object.keys(parsed[0]);
      const missing = expectedColumns.filter((c) => !headers.includes(c));
      if (missing.length) {
        toast.error("Colonnes manquantes", {
          description: missing.join(", "),
        });
        setParsing(false);
        return;
      }
      const validated: ImportRow<T>[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const raw = parsed[i];
        const { data, errors, isDuplicate } = await validateRow(raw, i);
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

  function setRowAction(index: number, action: ImportRow<T>["action"]) {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, action } : r)));
  }

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importRows(rows.filter((r) => r.action !== "skip" && r.data));
      toast.success("Import terminé", {
        description: `${result.inserted} créées · ${result.updated} mises à jour · ${result.skipped} ignorées · ${result.errors} erreurs`,
      });
      reset();
      onClose();
    } catch (e) {
      toast.error("Échec de l'import", { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  const counts = {
    new: rows.filter((r) => r.status === "new").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    error: rows.filter((r) => r.status === "error").length,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            )}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Glissez un fichier CSV ou XLSX</p>
            <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
            <p className="text-xs text-muted-foreground mt-4">
              Colonnes attendues : <span className="font-mono">{expectedColumns.join(", ")}</span>
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
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
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-12">#</th>
                    {columnsPreview.map((c) => (
                      <th key={c.key} className="text-left px-3 py-2 font-medium">{c.label}</th>
                    ))}
                    <th className="text-left px-3 py-2 font-medium">État</th>
                    <th className="text-left px-3 py-2 font-medium w-40">Action</th>
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
                        r.status === "new" && "bg-success/5"
                      )}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{r.index + 1}</td>
                      {columnsPreview.map((c) => (
                        <td key={c.key} className="px-3 py-2">
                          {r.data && c.render ? c.render(r.data) : String(r.raw[c.key] ?? "")}
                        </td>
                      ))}
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
                          onChange={(e) => setRowAction(r.index, e.target.value as ImportRow<T>["action"])}
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
              <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={importing}>
                Annuler
              </Button>
              <Button onClick={handleImport} disabled={importing || rows.every((r) => r.action === "skip")}>
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
