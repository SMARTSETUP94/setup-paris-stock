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

/**
 * Suggère le prochain numéro disponible au format strict 4 chiffres (ex. 0001, 0042, 0150).
 * S'il existe 0001, 0002, 0042, propose 0043.
 */
export function suggestNumero(existingNumeros: string[]): string {
  const seq = existingNumeros
    .filter((n) => /^\d{4}$/.test(n))
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return String(next).padStart(4, "0");
}

/** Force la saisie à exactement 4 chiffres (rejette tout caractère non numérique, tronque à 4). */
export function sanitizeNumeroInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function isValidNumero(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export function formatDateFr(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function formatDateTimeFr(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function buildInvitationLink(token: string) {
  if (typeof window === "undefined") return `/tiers/acces?token=${token}`;
  return `${window.location.origin}/tiers/acces?token=${token}`;
}
