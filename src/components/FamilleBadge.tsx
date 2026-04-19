import { familleMeta } from "@/lib/familles";

export function FamilleBadge({ famille }: { famille: string | null | undefined }) {
  const meta = familleMeta(famille);
  return (
    <span
      className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${meta.color}1A`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}
