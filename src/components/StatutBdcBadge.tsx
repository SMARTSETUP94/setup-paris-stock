import { statutBdcMeta, type StatutBdc } from "@/lib/bdc";

export function StatutBdcBadge({ value }: { value: StatutBdc | string | null | undefined }) {
  const meta = statutBdcMeta(value);
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}
