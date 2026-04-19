import type { Database } from "@/integrations/supabase/types";

export type StatutAffaire = Database["public"]["Enums"]["statut_affaire"];
export type PermissionAcces = Database["public"]["Enums"]["permission_acces"];

export const STATUTS: { value: StatutAffaire; label: string; color: string; bg: string }[] = [
  { value: "devis", label: "Devis", color: "#6B7280", bg: "rgba(107,114,128,0.10)" },
  { value: "en_cours", label: "En cours", color: "#2F5BFF", bg: "rgba(47,91,255,0.10)" },
  { value: "termine", label: "Terminé", color: "#166534", bg: "rgba(22,101,52,0.10)" },
  { value: "archive", label: "Archivé", color: "#525252", bg: "rgba(212,212,212,0.40)" },
];

export function statutMeta(value: StatutAffaire | string | null | undefined) {
  return STATUTS.find((s) => s.value === value) ?? STATUTS[0];
}

export const PERMISSIONS: { value: PermissionAcces; label: string; description: string }[] = [
  { value: "lecture", label: "Lecture seule", description: "Le tiers peut consulter le stock alloué à l'affaire." },
  { value: "sortie", label: "Sortie uniquement", description: "Le tiers peut déclarer des sorties sur les panneaux alloués." },
  { value: "entree_sortie", label: "Entrée + Sortie", description: "Le tiers peut déclarer entrées et sorties sur l'affaire." },
];

export function permissionLabel(value: PermissionAcces | string | null | undefined) {
  return PERMISSIONS.find((p) => p.value === value)?.label ?? String(value ?? "");
}

export function suggestNumero(existingNumeros: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const seq = existingNumeros
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function formatDateFr(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function buildInvitationLink(token: string) {
  if (typeof window === "undefined") return `/tiers/acces?token=${token}`;
  return `${window.location.origin}/tiers/acces?token=${token}`;
}
