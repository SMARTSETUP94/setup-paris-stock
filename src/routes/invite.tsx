import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { BrandingLogo } from "@/components/BrandingLogo";
import { inspectToken, acceptInvite } from "@/lib/users.functions";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/invite")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Activation du compte — Setup Stock" },
      { name: "description", content: "Activez votre compte Setup Stock." },
    ],
  }),
  component: InvitePage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid"; email: string; nom: string | null }
  | { kind: "invalid"; reason: "not_found" | "used" | "expired" | "missing" };

function InvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const inspectFn = useServerFn(inspectToken);
  const acceptFn = useServerFn(acceptInvite);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "missing" });
      return;
    }
    void (async () => {
      try {
        const res = await inspectFn({ data: { token } });
        if (res.valid) {
          if (res.kind !== "invite_admin") {
            setState({ kind: "invalid", reason: "not_found" });
          } else {
            setState({ kind: "valid", email: res.email, nom: res.nom_complet });
          }
        } else {
          setState({ kind: "invalid", reason: res.reason });
        }
      } catch {
        setState({ kind: "invalid", reason: "not_found" });
      }
    })();
  }, [token, inspectFn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
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
      await acceptFn({ data: { token, password } });
      toast.success("Compte créé", { description: "Vous pouvez maintenant vous connecter." });
      navigate({ to: "/login" });
    } catch (err) {
      toast.error("Activation impossible", {
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

        {state.kind === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
            <h1 className="text-2xl">
              {state.reason === "expired"
                ? "Invitation expirée"
                : state.reason === "used"
                  ? "Invitation déjà utilisée"
                  : "Invitation invalide"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.reason === "expired"
                ? "Ce lien a expiré. Demandez à un administrateur de vous renvoyer une invitation."
                : state.reason === "used"
                  ? "Ce lien a déjà servi à créer un compte. Connectez-vous directement."
                  : "Le lien est introuvable ou incomplet."}
            </p>
            <Button onClick={() => navigate({ to: "/login" })} variant="outline">
              Aller à la connexion
            </Button>
          </div>
        )}

        {state.kind === "valid" && (
          <>
            <p className="eyebrow text-center mb-3">Activation du compte</p>
            <h1 className="text-center text-3xl mb-2">
              <CheckCircle2 className="h-6 w-6 inline-block mr-2 text-success align-[-4px]" />
              Bienvenue
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-8">
              Choisissez un mot de passe pour <strong>{state.email}</strong>
              {state.nom ? ` (${state.nom})` : ""}.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-pwd">Mot de passe</Label>
                <Input
                  id="invite-pwd"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm">Confirmer</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Activer mon compte
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
