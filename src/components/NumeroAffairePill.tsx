import { Link } from "@tanstack/react-router";

interface Props {
  numero: string | null;
  codeChantier?: string;
  asLink?: boolean;
  className?: string;
}

export function NumeroAffairePill({ numero, codeChantier, asLink = true, className = "" }: Props) {
  const label = numero ?? "—";
  const cls = `font-mono text-xs px-2 py-0.5 rounded bg-muted ${asLink && codeChantier ? "hover:bg-foreground/10 transition-colors" : ""} ${className}`;
  if (asLink && codeChantier) {
    return (
      <Link to="/affaires/$code" params={{ code: codeChantier }} className={cls}>
        {label}
      </Link>
    );
  }
  return <span className={cls}>{label}</span>;
}
