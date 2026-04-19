import { Link } from "@tanstack/react-router";

interface Props {
  numero: string;
  asLink?: boolean;
  className?: string;
}

export function NumeroAffairePill({ numero, asLink = true, className = "" }: Props) {
  const cls = `font-mono text-xs px-2 py-0.5 rounded bg-muted ${asLink ? "hover:bg-foreground/10 transition-colors" : ""} ${className}`;
  if (asLink) {
    return (
      <Link to="/affaires/$numero" params={{ numero }} className={cls}>
        {numero}
      </Link>
    );
  }
  return <span className={cls}>{numero}</span>;
}
