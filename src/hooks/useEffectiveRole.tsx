import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

/**
 * Vue "Preview As" — purement frontend.
 *
 * Un admin peut basculer son interface dans la peau d'un autre rôle pour
 * auditer l'UX, SANS modifier son rôle réel en base. Les RLS serveur
 * restent inchangées.
 *
 * - `realRole` : ce que dit la DB (immuable)
 * - `previewRole` : choix admin persisté en localStorage (peut valoir un
 *   rôle DB ou la pseudo-vue `mobile_atelier`)
 * - `effectiveRole` : ce que l'UI doit utiliser pour ses décisions de rendu
 */

export type PreviewRole = AppRole | "mobile_atelier";

const STORAGE_KEY = "setup-preview-role";

function readStored(): PreviewRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "admin" || v === "magasinier" || v === "mobile" || v === "mobile_atelier") {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

type EffectiveRoleContextValue = {
  realRole: AppRole | undefined;
  previewRole: PreviewRole | null;
  effectiveRole: PreviewRole | undefined;
  isPreview: boolean;
  canPreview: boolean;
  setPreview: (role: PreviewRole | null) => void;
};

const Ctx = createContext<EffectiveRoleContextValue | undefined>(undefined);

export function EffectiveRoleProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const realRole = profile?.role;
  const [previewRole, setPreviewRole] = useState<PreviewRole | null>(() => readStored());

  // Si l'utilisateur perd son statut admin (ou se déconnecte), on purge.
  useEffect(() => {
    if (previewRole && realRole !== "admin") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      setPreviewRole(null);
    }
  }, [previewRole, realRole]);

  const setPreview = useCallback((role: PreviewRole | null) => {
    try {
      if (role) window.localStorage.setItem(STORAGE_KEY, role);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore quota / private mode
    }
    setPreviewRole(role);
  }, []);

  const value = useMemo<EffectiveRoleContextValue>(
    () => ({
      realRole,
      previewRole,
      effectiveRole: (previewRole ?? realRole) as PreviewRole | undefined,
      isPreview: previewRole !== null,
      canPreview: realRole === "admin",
      setPreview,
    }),
    [realRole, previewRole, setPreview],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEffectiveRole(): EffectiveRoleContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEffectiveRole doit être utilisé dans EffectiveRoleProvider");
  return ctx;
}

export const PREVIEW_ROLE_LABELS: Record<PreviewRole, string> = {
  admin: "Admin",
  magasinier: "Magasinier",
  mobile: "Mobile",
  mobile_atelier: "Mobile atelier",
};

/** Le rôle effectif est-il "atelier" (vrai mobile DB ou vue mobile_atelier) ? */
export function isAtelierRole(r: PreviewRole | undefined | null): boolean {
  return r === "mobile" || r === "mobile_atelier";
}
