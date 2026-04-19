import type { Database } from "@/integrations/supabase/types";

export type TypeMouvement = Database["public"]["Enums"]["type_mouvement"];

export const TYPES_MVT: {
  value: TypeMouvement;
  label: string;
  short: string;
  color: string;
  bg: string;
}[] = [
  {
    value: "entree",
    label: "Entrée",
    short: "Entrée",
    color: "#166534",
    bg: "rgba(22,101,52,0.10)",
  },
  {
    value: "sortie",
    label: "Sortie",
    short: "Sortie",
    color: "#9F1239",
    bg: "rgba(159,18,57,0.08)",
  },
  {
    value: "correction",
    label: "Correction",
    short: "Correction",
    color: "#92400E",
    bg: "rgba(146,64,14,0.10)",
  },
  {
    value: "chute_reintegration",
    label: "Chute (réintégration)",
    short: "Chute",
    color: "#1E40AF",
    bg: "rgba(30,64,175,0.10)",
  },
];

export function typeMeta(value: TypeMouvement | string | null | undefined) {
  return TYPES_MVT.find((t) => t.value === value) ?? TYPES_MVT[0];
}
