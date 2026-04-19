import { Eye, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useEffectiveRole,
  PREVIEW_ROLE_LABELS,
  type PreviewRole,
} from "@/hooks/useEffectiveRole";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PreviewRole | null; label: string; hint: string }[] = [
  { value: null, label: "Admin", hint: "Vue complète (par défaut)" },
  { value: "magasinier", label: "Magasinier", hint: "Stock, BDC, fournisseurs" },
  { value: "mobile_atelier", label: "Mobile atelier", hint: "Scan + inventaire uniquement" },
];

/**
 * Switcher de mode "Preview as", affiché uniquement aux vrais admins.
 * Placé dans la sidebar au-dessus du bloc utilisateur.
 */
export function PreviewRoleSwitcher() {
  const { canPreview, previewRole, setPreview } = useEffectiveRole();
  if (!canPreview) return null;

  const currentLabel = previewRole ? PREVIEW_ROLE_LABELS[previewRole] : "Admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            "border border-border bg-card hover:bg-muted text-foreground",
          )}
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Mode aperçu
            </span>
            <span className="block text-sm font-medium truncate">{currentLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Voir l'app comme…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((opt) => {
          const isSelected = (opt.value ?? null) === (previewRole ?? null);
          return (
            <DropdownMenuItem
              key={opt.label}
              onClick={() => setPreview(opt.value)}
              className="flex items-start gap-2 py-2"
            >
              <Check
                className={cn("h-4 w-4 mt-0.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.hint}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
