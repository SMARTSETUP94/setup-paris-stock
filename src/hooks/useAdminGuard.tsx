import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
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
 * - Par défaut : admin OU magasinier ont accès.
 * - Avec `{ adminOnly: true }` : uniquement admin (utilisé pour Paramètres).
 * Les utilisateurs `mobile` sont redirigés vers /scan, les autres vers /.
 */
export function useAdminGuard(options: GuardOptions = {}) {
  const { adminOnly = false } = options;
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      navigate({ to: "/login" });
      return;
    }
    const role = profile.role;
    const allowed = adminOnly ? role === "admin" : role === "admin" || role === "magasinier";
    if (!allowed) {
      // Mobile -> scan ; tout autre cas (magasinier sur page admin) -> dashboard
      navigate({ to: role === "mobile" ? "/scan" : "/" });
      return;
    }
    setChecked(true);
  }, [profile, loading, navigate, adminOnly]);

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
