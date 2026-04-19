import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Échec d'envoi", { description: error.message });
    } else {
      toast.success("Lien magique envoyé", {
        description: "Vérifiez votre boîte mail pour vous connecter.",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-center gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-[color:var(--color-heading)]">
            SET UP
          </span>
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-[#FFB700] text-[12px] font-bold text-black"
          >
            ⚡
          </span>
        </div>

        <p className="eyebrow text-center mb-3">Espace de connexion</p>
        <h1 className="text-center text-3xl mb-2">Setup Stock</h1>
        <p className="text-center text-sm text-muted-foreground mb-10">
          Gestion de stock — Setup Paris
        </p>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-6 bg-transparent border border-border rounded-lg p-1">
            <TabsTrigger value="password" className="rounded-md data-[state=active]:bg-foreground data-[state=active]:text-background">
              Mot de passe
            </TabsTrigger>
            <TabsTrigger value="magic" className="rounded-md data-[state=active]:bg-foreground data-[state=active]:text-background">
              Lien magique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password">
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
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-magic">Email</Label>
                <Input
                  id="email-magic"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@setupparis.fr"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Vous recevrez un lien à usage unique par email pour vous connecter sans mot de passe.
              </p>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envoyer le lien
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
