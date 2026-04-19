import Papa from "papaparse";

// xlsx (~800 kB) chargé à la demande pour ne pas alourdir le bundle initial.
// Les deux helpers ci-dessous sont déjà async ou appelés sur action utilisateur.
async function loadXLSX() {
  return await import("xlsx");
}

export type ImportRowStatus = "new" | "duplicate" | "error" | "update";

export interface ImportRow<T> {
  index: number;
  data: T;
  status: ImportRowStatus;
  errors: string[];
  action: "create" | "skip" | "overwrite";
}

export async function parseFile(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "txt") {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      });
    });
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await loadXLSX();
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }
  throw new Error(`Format non supporté : ${ext}`);
}

export async function exportXLSX<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
) {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, filename);
}

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "vrai", "oui", "yes", "y", "x"].includes(s);
}
