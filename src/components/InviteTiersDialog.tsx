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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PERMISSIONS, buildInvitationLink, type PermissionAcces } from "@/lib/affaires";

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
  const [permissions, setPermissions] = useState<PermissionAcces>("lecture");
  const [expire, setExpire] = useState(isoPlusDays(30));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setPermissions("lecture");
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
      permissions,
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
      toast.success("Lien copié — collez-le dans WhatsApp/email pour l'envoyer au tiers.");
    } catch {
      toast.success("Invitation créée. Lien : " + link);
    }
    onCreated?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un tiers</DialogTitle>
          <DialogDescription>
            Génère un lien magique. Aucune email automatique : copiez le lien et envoyez-le par
            WhatsApp ou email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.fr"
            />
          </div>
          <div>
            <Label className="mb-2 block">Permissions</Label>
            <RadioGroup
              value={permissions}
              onValueChange={(v) => setPermissions(v as PermissionAcces)}
            >
              {PERMISSIONS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted"
                >
                  <RadioGroupItem value={p.value} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
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
