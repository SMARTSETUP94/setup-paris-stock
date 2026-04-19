import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildInvitationLink } from "@/lib/affaires";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  affaireId: string;
  onCreated?: () => void;
}

function isoPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InviteTiersDialog({ open, onOpenChange, affaireId, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [expire, setExpire] = useState(isoPlusDays(30));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setExpire(isoPlusDays(30));
      setMessage("");
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Email invalide");
      return;
    }
    setLoading(true);
    const token = crypto.randomUUID();
    const expireIso = new Date(`${expire}T23:59:59`).toISOString();
    const { error } = await supabase.from("affaire_acces").insert({
      affaire_id: affaireId,
      email_invite: trimmed,
      token,
      permissions: "lecture",
      expire_le: expireIso,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const link = buildInvitationLink(token);
    const fullText = message ? `${message}\n\n${link}` : link;
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("Lien copié — collez-le dans WhatsApp/email pour l'envoyer.");
    } catch {
      toast.success("Lien généré : " + link);
    }
    onCreated?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau lien externe</DialogTitle>
          <DialogDescription>
            Génère un lien de consultation en lecture seule à partager avec un client, un
            fournisseur ou un sous-traitant. Aucune action possible — uniquement la visualisation
            du stock alloué et de la consommation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Email du destinataire</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.fr"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sert d'étiquette pour identifier le lien — l'envoi reste manuel (WhatsApp/email).
            </p>
          </div>
          <div>
            <Label>Expiration</Label>
            <Input
              type="date"
              value={expire}
              min={isoPlusDays(1)}
              max={isoPlusDays(365)}
              onChange={(e) => setExpire(e.target.value)}
            />
          </div>
          <div>
            <Label>Message personnel (optionnel)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Sera ajouté au-dessus du lien copié."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Création…" : "Générer et copier le lien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
