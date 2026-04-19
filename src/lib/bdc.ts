import type { Database } from "@/integrations/supabase/types";

export type StatutBdc = Database["public"]["Enums"]["statut_bdc"];

export const STATUTS_BDC: {
  value: StatutBdc;
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: "en_attente_ocr", label: "OCR en cours", color: "#1E40AF", bg: "rgba(30,64,175,0.10)" },
  { value: "ocr_termine", label: "À valider", color: "#92400E", bg: "rgba(146,64,14,0.10)" },
  { value: "valide", label: "Validé", color: "#166534", bg: "rgba(22,101,52,0.10)" },
  { value: "recu", label: "Reçu", color: "#064E3B", bg: "rgba(6,78,59,0.10)" },
  { value: "annule", label: "Annulé", color: "#525252", bg: "rgba(82,82,82,0.10)" },
];

export function statutBdcMeta(value: StatutBdc | string | null | undefined) {
  return STATUTS_BDC.find((s) => s.value === value) ?? STATUTS_BDC[0];
}

export function confidenceMeta(c: number | null | undefined) {
  const v = typeof c === "number" ? c : 0;
  if (v >= 0.9)
    return { label: `${Math.round(v * 100)}%`, color: "#166534", bg: "rgba(22,101,52,0.10)" };
  if (v >= 0.7)
    return { label: `${Math.round(v * 100)}%`, color: "#92400E", bg: "rgba(146,64,14,0.10)" };
  return {
    label: c === null || c === undefined ? "—" : `${Math.round(v * 100)}%`,
    color: "#9F1239",
    bg: "rgba(159,18,57,0.08)",
  };
}

export function extractNumeroFromFilename(filename: string): string | null {
  const m = filename.match(/(\d{4,})/);
  return m ? m[1] : null;
}
