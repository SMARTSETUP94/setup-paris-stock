import { useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Affiche le sous-titre "BY SETUP.PARIS" sous le wordmark */
  showTagline?: boolean;
  /** Force la couleur du wordmark (par défaut foreground) — utile sur fond sombre/photo */
  variant?: "default" | "light";
};

const SIZES = {
  sm: { word: "text-[15px]", sub: "text-[9px]", dot: "h-1.5 w-1.5", gap: "gap-2" },
  md: { word: "text-lg", sub: "text-[10px]", dot: "h-1.5 w-1.5", gap: "gap-2.5" },
  lg: { word: "text-2xl", sub: "text-[11px]", dot: "h-2 w-2", gap: "gap-3" },
} as const;

/**
 * Logo Setup Paris style éditorial :
 * • SETUP PARIS  ← wordmark en sans-serif tight, "PARIS" en weight regular
 *   BY SETUP.PARIS ↗ ← tagline mono caps
 *
 * Si un logo image est uploadé via /parametres → affiche l'image à la place.
 */
export function BrandingLogo({
  size = "sm",
  className,
  showTagline = true,
  variant = "default",
}: Props) {
  const { branding } = useBranding();
  const s = SIZES[size];
  const accent = branding.couleur_accent || "var(--color-primary)";
  const wordColor = variant === "light" ? "text-white" : "text-[color:var(--color-heading)]";
  const subColor = variant === "light" ? "text-white/70" : "text-muted-foreground";

  // Logo image uploadé : on l'affiche seul
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

  // Découpage "SETUP PARIS" → premier mot bold, reste regular
  const orgRaw = (branding.nom_organisation || "Setup Paris").trim();
  const [firstWord, ...restWords] = orgRaw.split(/\s+/);
  const rest = restWords.join(" ");

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <span
        aria-hidden
        className={cn("rounded-full shrink-0", s.dot)}
        style={{ backgroundColor: accent }}
      />
      <div className="flex flex-col leading-none">
        <span className={cn("font-display font-semibold tracking-tight uppercase", s.word, wordColor)}>
          {firstWord.toUpperCase()}
          {rest ? (
            <>
              {" "}
              <span className="font-light">{rest.toUpperCase()}</span>
            </>
          ) : null}
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 font-mono tracking-[0.18em] uppercase",
              s.sub,
              subColor,
            )}
          >
            BY {orgRaw.toUpperCase().replace(/\s+/g, ".")} ↗
          </span>
        )}
      </div>
    </div>
  );
}
