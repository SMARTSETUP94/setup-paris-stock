import { useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Affiche le texte "SET UP" à côté du logo si pas de logo uploadé */
  showText?: boolean;
};

const SIZES = {
  sm: { box: "h-5 w-5", text: "text-base" },
  md: { box: "h-6 w-6", text: "text-xl" },
  lg: { box: "h-10 w-10", text: "text-2xl" },
} as const;

export function BrandingLogo({ size = "sm", className, showText = true }: Props) {
  const { branding } = useBranding();
  const s = SIZES[size];
  const accent = branding.couleur_accent || "#FFB700";

  // Logo uploadé : on l'affiche seul (sans texte)
  if (branding.logo_url) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <img
          src={branding.logo_url}
          alt={branding.nom_organisation}
          className={cn(
            size === "sm" && "h-6 w-auto",
            size === "md" && "h-8 w-auto",
            size === "lg" && "h-12 w-auto",
            "object-contain",
          )}
        />
      </div>
    );
  }

  // Fallback texte SET UP + carré accent (initiale du nom organisation)
  const initial = branding.nom_organisation.trim().charAt(0).toUpperCase() || "S";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showText && (
        <span
          className={cn(
            "font-display font-semibold tracking-tight text-[color:var(--color-heading)]",
            s.text,
          )}
        >
          {(branding.nom_organisation || "Setup").toUpperCase()}
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-sm text-[10px] font-bold text-black",
          s.box,
        )}
        style={{ backgroundColor: accent }}
      >
        {initial}
      </span>
    </div>
  );
}
