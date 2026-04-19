import { Eye, X } from "lucide-react";
import { useEffectiveRole, PREVIEW_ROLE_LABELS } from "@/hooks/useEffectiveRole";

/**
 * Bandeau permanent affiché quand l'admin est en mode "Preview as".
 * Rappelle qu'on simule un autre rôle et permet de quitter d'un clic.
 */
export function PreviewModeBanner() {
  const { isPreview, previewRole, setPreview } = useEffectiveRole();
  if (!isPreview || !previewRole) return null;

  return (
    <div
      role="status"
      className="w-full border-b border-amber-300 bg-amber-100 text-amber-900 px-4 py-2 text-xs sm:text-sm flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong>Mode aperçu :</strong> {PREVIEW_ROLE_LABELS[previewRole]}.{" "}
          <span className="hidden sm:inline text-amber-800/80">
            Les actions peuvent être restreintes par les règles serveur.
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setPreview(null)}
        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-200/60 hover:bg-amber-200 px-2 py-1 text-xs font-medium transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Quitter l'aperçu
      </button>
    </div>
  );
}
