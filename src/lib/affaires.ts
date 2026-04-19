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
  {
    value: "lecture",
    label: "Lecture seule",
    description: "Le tiers peut consulter le stock alloué à l'affaire.",
  },
  {
    value: "sortie",
    label: "Sortie uniquement",
    description: "Le tiers peut déclarer des sorties sur les panneaux alloués.",
  },
  {
    value: "entree_sortie",
    label: "Entrée + Sortie",
    description: "Le tiers peut déclarer entrées et sorties sur l'affaire.",
  },
];

export function permissionLabel(value: PermissionAcces | string | null | undefined) {
  return PERMISSIONS.find((p) => p.value === value)?.label ?? String(value ?? "");
}

/**
 * Extrait le préfixe numérique (3 à 5 chiffres) en tête d'un code_chantier.
 * Ex : "9145_Prototype" → "9145" ; "Stockage chalet" → null.
 */
export function extractNumeroFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.match(/^(\d{3,5})/);
  return m ? m[1] : null;
}

/**
 * Suggère le prochain code_chantier en se basant sur le plus grand numéro existant + 1.
 * Ex : si max=9197, propose "9198_". Si aucun numéro, propose "" (libre).
 */
export function suggestCodeChantier(existingNumeros: (string | null)[]): string {
  const seq = existingNumeros
    .filter((n): n is string => !!n)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  if (seq.length === 0) return "";
  const next = Math.max(...seq) + 1;
  return `${next}_`;
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
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return "—";
  }
}

export function buildInvitationLink(token: string) {
  if (typeof window === "undefined") return `/tiers/acces?token=${token}`;
  return `${window.location.origin}/tiers/acces?token=${token}`;
}

/**
 * Normalise une chaîne pour matching fuzzy : minuscule, sans accents, sans ponctuation.
 */
export function normalizeForMatch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
