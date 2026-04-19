import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandingLogo } from "@/components/BrandingLogo";
import { requestPasswordReset } from "@/lib/users.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Setup Stock" },
      { name: "description", content: "Accès sécurisé à la gestion de stock Setup Paris." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const requestResetFn = useServerFn(requestPasswordReset);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Échec de connexion", { description: error.message });
    } else {
      toast.success("Connexion réussie");
      navigate({ to: "/" });
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Email requis", {
        description: "Saisissez votre email avant de demander une réinitialisation.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await requestResetFn({ data: { email } });
      toast.success("Email envoyé", {
        description: "Si un compte existe pour cet email, un lien vous a été envoyé.",
      });
    } catch (err) {
      toast.error("Envoi impossible", {
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

        <p className="eyebrow text-center mb-3">Espace de connexion</p>
        <h1 className="text-center text-3xl mb-2">Setup Stock</h1>
        <p className="text-center text-sm text-muted-foreground mb-10">
          Gestion de stock — Setup Paris
        </p>

        <form onSubmit={handlePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-pwd">Email</Label>
            <Input
              id="email-pwd"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom@setupparis.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Se connecter
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={handleForgotPassword}
            className="block w-full text-center text-sm text-muted-foreground"
            disabled={submitting}
          >
            Mot de passe oublié ?
          </Button>
        </form>
      </div>
    </div>
  );
}
