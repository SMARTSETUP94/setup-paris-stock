/**
 * ROUTE PUBLIQUE — consomme un token unique généré par la server function
 * `requestPasswordReset` (ou `inviteUser` pour un email déjà existant).
 * Le token est vérifié côté serveur via `inspectToken` avant d'autoriser
 * la mise à jour du mot de passe.
 *
 * Sécurité :
 *   - Token aléatoire 256 bits, à usage unique
 *   - Expiration 2 heures côté DB
 *   - Compatibilité legacy : accepte aussi un access_token Supabase dans le hash
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { BrandingLogo } from "@/components/BrandingLogo";
import { inspectToken, resetPasswordWithToken } from "@/lib/users.functions";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Réinitialiser le mot de passe — Setup Stock" },
      { name: "description", content: "Définir un nouveau mot de passe pour Setup Stock." },
    ],
  }),
  component: ResetPasswordPage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid_token"; email: string }
  | { kind: "supabase_session" } // legacy : lien supabase #access_token
  | { kind: "invalid"; reason: "not_found" | "used" | "expired" | "missing" };

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const inspectFn = useServerFn(inspectToken);
  const resetFn = useServerFn(resetPasswordWithToken);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Token custom (Resend) ?
      if (token) {
        try {
          const res = await inspectFn({ data: { token } });
          if (cancelled) return;
          if (res.valid && res.kind === "password_reset") {
            setState({ kind: "valid_token", email: res.email });
          } else if (res.valid) {
            setState({ kind: "invalid", reason: "not_found" });
          } else {
            setState({ kind: "invalid", reason: res.reason });
          }
        } catch {
          if (!cancelled) setState({ kind: "invalid", reason: "not_found" });
        }
        return;
      }

      // 2. Fallback : ancien flow Supabase (#access_token=...&type=recovery)
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setState({ kind: "supabase_session" });
      } else {
        // Attendre brièvement un PASSWORD_RECOVERY event
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setState({ kind: "supabase_session" });
          }
        });
        setTimeout(() => {
          if (!cancelled) {
            sub.subscription.unsubscribe();
            setState((s) => (s.kind === "loading" ? { kind: "invalid", reason: "missing" } : s));
          }
        }, 1500);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [token, inspectFn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Mot de passe trop court", { description: "8 caractères minimum." });
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSubmitting(true);
    try {
      if (state.kind === "valid_token" && token) {
        await resetFn({ data: { token, password } });
        toast.success("Mot de passe mis à jour", { description: "Connectez-vous à présent." });
        navigate({ to: "/login" });
      } else if (state.kind === "supabase_session") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Mot de passe mis à jour");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error("Échec de mise à jour", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-center gap-2">
          <BrandingLogo size="md" />
        </div>

        <p className="eyebrow text-center mb-3">Sécurité du compte</p>
        <h1 className="text-center text-3xl mb-2">Nouveau mot de passe</h1>
        <p className="text-center text-sm text-muted-foreground mb-10">
          {state.kind === "valid_token"
            ? `Pour ${state.email}.`
            : "Choisissez un nouveau mot de passe pour votre compte Setup Stock."}
        </p>

        {state.kind === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
            <p className="text-sm text-muted-foreground">
              {state.reason === "expired"
                ? "Ce lien a expiré. Demandez-en un nouveau depuis l'écran de connexion."
                : state.reason === "used"
                  ? "Ce lien a déjà été utilisé."
                  : "Lien introuvable ou incomplet. Demandez un nouveau lien depuis l'écran de connexion."}
            </p>
            <Button onClick={() => navigate({ to: "/login" })} variant="outline">
              Retour à la connexion
            </Button>
          </div>
        )}

        {(state.kind === "valid_token" || state.kind === "supabase_session") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mettre à jour
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
