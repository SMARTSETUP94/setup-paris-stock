import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Numéro éditorial de section (ex. "01", "02"). S'affiche en marqueur "— 01 —" devant l'eyebrow. */
  sectionNumber?: string;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Variant compact pour pages denses (BDC, mouvements) */
  variant?: "default" | "compact";
}

export function PageHeader({
  sectionNumber,
  eyebrow,
  title,
  description,
  actions,
  variant = "default",
}: PageHeaderProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        isCompact ? "mb-6" : "mb-10 md:mb-12",
      )}
    >
      <div>
        <p className="eyebrow mb-3 flex items-center gap-2 text-primary">
          {sectionNumber && (
            <>
              <span className="font-mono">— {sectionNumber}</span>
              <span className="text-muted-foreground">·</span>
            </>
          )}
          <span>{eyebrow}</span>
        </p>
        <h1
          className={cn(
            "tracking-tight",
            isCompact ? "text-2xl md:text-3xl" : "text-3xl md:text-5xl",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
