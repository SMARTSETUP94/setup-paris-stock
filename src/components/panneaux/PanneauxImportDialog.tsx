import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { ImportDialog, type ImportRow } from "@/components/ImportDialog";
import type { CatRow, Matiere } from "./types";

export function PanneauxImportDialog({
  matieres,
  items,
  onClose,
}: {
  matieres: Matiere[];
  items: CatRow[];
  onClose: () => void;
}) {
  return (
    <ImportDialog<TablesInsert<"panneaux"> & { _matiere_code: string }>
      open
      onClose={onClose}
      title="Importer des panneaux"
      description="CSV/XLSX. La matière doit déjà exister (par code)."
      expectedColumns={["matiere_code", "longueur_mm", "largeur_mm", "epaisseur_mm"]}
      validateRow={async (raw) => {
        const errors: string[] = [];
        const matCode = String(raw.matiere_code ?? "").trim();
        const matiere = matieres.find((m) => m.code.toLowerCase() === matCode.toLowerCase());
        if (!matCode) errors.push("Code matière requis");
        else if (!matiere) errors.push(`Matière inconnue : ${matCode}`);
        const lon = Number(String(raw.longueur_mm ?? "").replace(",", "."));
        if (!Number.isFinite(lon) || lon <= 0) errors.push("Longueur invalide");
        const lar = Number(String(raw.largeur_mm ?? "").replace(",", "."));
        if (!Number.isFinite(lar) || lar <= 0) errors.push("Largeur invalide");
        const ep = Number(String(raw.epaisseur_mm ?? "").replace(",", "."));
        if (!Number.isFinite(ep) || ep <= 0) errors.push("Épaisseur invalide");
        const prixRaw = String(raw.prix_achat_ht ?? "").replace(",", ".");
        const prix = prixRaw ? Number(prixRaw) : null;
        const refF = String(raw.reference_fournisseur ?? "").trim() || null;
        const isDuplicate = matiere
          ? items.some(
              (p) =>
                p.matiere_id === matiere.id &&
                p.longueur_mm === Math.round(lon) &&
                p.largeur_mm === Math.round(lar) &&
                p.epaisseur_mm === Math.round(ep),
            )
          : false;
        return {
          data:
            errors.length || !matiere
              ? null
              : {
                  matiere_id: matiere.id,
                  longueur_mm: Math.round(lon),
                  largeur_mm: Math.round(lar),
                  epaisseur_mm: Math.round(ep),
                  prix_achat_ht: prix,
                  reference_fournisseur: refF,
                  _matiere_code: matCode,
                },
          errors,
          isDuplicate,
        };
      }}
      columnsPreview={[
        { key: "matiere_code", label: "Matière" },
        { key: "longueur_mm", label: "Longueur" },
        { key: "largeur_mm", label: "Largeur" },
        { key: "epaisseur_mm", label: "Ép. (mm)" },
        { key: "prix_achat_ht", label: "Prix HT" },
        { key: "reference_fournisseur", label: "Réf. fournisseur" },
      ]}
      importRows={async (rows: ImportRow<TablesInsert<"panneaux"> & { _matiere_code: string }>[]) => {
        let inserted = 0,
          updated = 0,
          skipped = 0,
          errors = 0;
        for (const r of rows) {
          if (!r.data) {
            skipped++;
            continue;
          }
          const { _matiere_code: _ignored, ...payload } = r.data;
          if (r.action === "overwrite") {
            const { error } = await supabase
              .from("panneaux")
              .update(payload)
              .eq("matiere_id", payload.matiere_id)
              .eq("longueur_mm", payload.longueur_mm)
              .eq("largeur_mm", payload.largeur_mm)
              .eq("epaisseur_mm", payload.epaisseur_mm);
            if (error) errors++;
            else updated++;
          } else if (r.action === "create") {
            const { error } = await supabase.from("panneaux").insert(payload);
            if (error) errors++;
            else inserted++;
          } else skipped++;
        }
        return { inserted, updated, skipped, errors };
      }}
    />
  );
}
