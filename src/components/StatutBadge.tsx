import { statutMeta, type StatutAffaire } from "@/lib/affaires";

export function StatutBadge({ value }: { value: StatutAffaire | string | null | undefined }) {
  const meta = statutMeta(value);
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}
