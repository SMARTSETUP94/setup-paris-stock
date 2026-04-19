import { typeMeta } from "@/lib/mouvements";

export function TypeMouvementBadge({ value }: { value: string | null | undefined }) {
  const meta = typeMeta(value);
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.short}
    </span>
  );
}
