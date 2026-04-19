import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveRole, isAtelierRole } from "@/hooks/useEffectiveRole";
import { Loader2 } from "lucide-react";

type GuardOptions = {
  /**
   * Si true, seul un admin est autorisé.
   * Sinon (défaut) : admin OU magasinier.
   */
  adminOnly?: boolean;
};

/**
 * Garde de routes back-office.
 *
 * Utilise le **rôle effectif** (vrai rôle ou "Preview as" admin) pour décider
 * de l'accès. La vraie sécurité reste côté RLS — ici on ne fait que de la
 * cohérence visuelle.
 *
 * - Par défaut : admin OU magasinier (effectifs) ont accès.
 * - Avec `{ adminOnly: true }` : uniquement admin effectif (Paramètres).
 * - Vue "atelier" (mobile DB ou preview mobile_atelier) → redirige vers /scan.
 * - Magasinier qui tape une URL admin-only → redirige vers /.
 */
export function useAdminGuard(options: GuardOptions = {}) {
  const { adminOnly = false } = options;
  const { profile, loading } = useAuth();
  const { effectiveRole } = useEffectiveRole();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      navigate({ to: "/login" });
      return;
    }
    const role = effectiveRole;
    if (isAtelierRole(role)) {
      navigate({ to: "/scan" });
      return;
    }
    const allowed = adminOnly ? role === "admin" : role === "admin" || role === "magasinier";
    if (!allowed) {
      navigate({ to: "/" });
      return;
    }
    setChecked(true);
  }, [profile, loading, navigate, adminOnly, effectiveRole]);

  return { ready: checked, profile };
}

export function AdminLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useToggle(initial = false): [boolean, () => void, (v: boolean) => void] {
  const [v, setV] = useState(initial);
  const toggle = useCallback(() => setV((x) => !x), []);
  return [v, toggle, setV];
}
