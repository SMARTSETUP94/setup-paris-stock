import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal, UserPlus, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAdminGuard, AdminLoader } from "@/hooks/useAdminGuard";
import {
  listUsers,
  inviteUser,
  resendInvitation,
  setUserActive,
  setUserRole,
  deleteUser,
} from "@/lib/users.functions";
import { BrandingTab } from "@/components/parametres/BrandingTab";

type AppRole = "admin" | "magasinier" | "mobile";

type UserRow = {
  id: string;
  email: string;
  nom_complet: string | null;
  role: AppRole;
  actif: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  magasinier: "Magasinier",
  mobile: "Mobile",
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Accès complet, y compris paramètres et gestion des utilisateurs.",
  magasinier: "Gère catalogue, BDC, affaires, mouvements et inventaire. Pas d'accès aux paramètres.",
  mobile: "Sortie de stock uniquement via scan. Aucun autre accès.",
};

export const Route = createFileRoute("/_app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Setup Stock" }] }),
  component: ParametresPage,
});

function ParametresPage() {
  const { ready } = useAdminGuard({ adminOnly: true });
  if (!ready) return <AdminLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Paramètres"
        title="Paramètres"
        description="Gestion du compte et des accès."
      />
      <Tabs defaultValue="utilisateurs" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>
        <TabsContent value="utilisateurs">
          <UsersTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: UserRow; newRole: AppRole } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listUsers();
      setUsers(res.users as UserRow[]);
    } catch (e) {
      toast.error("Chargement impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.actif !== b.actif) return a.actif ? -1 : 1;
        return (a.nom_complet ?? a.email).localeCompare(b.nom_complet ?? b.email);
      }),
    [users],
  );

  async function handleToggleActive(u: UserRow) {
    try {
      await setUserActive({ data: { user_id: u.id, actif: !u.actif } });
      toast.success(u.actif ? "Compte désactivé" : "Compte réactivé");
      void refresh();
    } catch (e) {
      toast.error("Action impossible", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  function requestRoleChange(u: UserRow, role: AppRole) {
    if (u.role === role) return;
    setConfirmRole({ user: u, newRole: role });
  }

  async function confirmRoleChange() {
    if (!confirmRole) return;
    setUpdatingRole(true);
    try {
      await setUserRole({ data: { user_id: confirmRole.user.id, role: confirmRole.newRole } });
      toast.success("Rôle mis à jour", {
        description: `${confirmRole.user.email} est désormais ${ROLE_LABELS[confirmRole.newRole]}.`,
      });
      setConfirmRole(null);
      void refresh();
    } catch (e) {
      toast.error("Action impossible", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handleResend(u: UserRow) {
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      await resendInvitation({ data: { email: u.email, redirectTo } });
      toast.success("Email envoyé", {
        description: "Un lien de réinitialisation a été envoyé.",
      });
    } catch (e) {
      toast.error("Envoi impossible", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteUser({ data: { user_id: confirmDelete.id } });
      toast.success("Compte supprimé");
      setConfirmDelete(null);
      void refresh();
    } catch (e) {
      toast.error("Suppression impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start gap-3 bg-warning/10 border-warning/30">
        <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Inscriptions publiques désactivées</p>
          <p className="text-muted-foreground">
            Les nouveaux utilisateurs sont créés uniquement via invitation depuis cet écran. Ils
            reçoivent un email pour définir leur mot de passe.
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Chargement…" : `${users.length} utilisateur${users.length > 1 ? "s" : ""}`}
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un utilisateur
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Aucun utilisateur.</div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((u) => {
              const isMe = u.id === profile?.id;
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {u.nom_complet || u.email}
                      </span>
                      {isMe && (
                        <Badge variant="outline" className="text-[10px]">
                          Vous
                        </Badge>
                      )}
                      {!u.actif && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive/40 text-destructive"
                        >
                          Désactivé
                        </Badge>
                      )}
                      {!u.email_confirmed_at && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-warning/40 text-warning"
                        >
                          En attente
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>

                  <Select
                    value={u.role}
                    onValueChange={(v) => handleChangeRole(u, v as "admin" | "tiers")}
                    disabled={isMe}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="tiers">Tiers</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleResend(u)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Renvoyer un lien
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(u)} disabled={isMe}>
                        {u.actif ? "Désactiver le compte" : "Réactiver le compte"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDelete(u)}
                        disabled={isMe}
                      >
                        Supprimer définitivement
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => {
          setInviteOpen(false);
          void refresh();
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>définitive</strong>. L'utilisateur{" "}
              <strong>{confirmDelete?.email}</strong> ne pourra plus se connecter et son profil sera
              supprimé. L'historique des mouvements créés est conservé mais ne sera plus attribué à
              un utilisateur. Préférez la désactivation si vous n'êtes pas sûr.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [role, setRole] = useState<"admin" | "tiers">("tiers");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setNomComplet("");
      setRole("tiers");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      await inviteUser({ data: { email, nom_complet: nomComplet, role, redirectTo } });
      toast.success("Invitation envoyée", {
        description: `${email} va recevoir un email pour créer son mot de passe.`,
      });
      onInvited();
    } catch (err) {
      toast.error("Invitation impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
            <DialogDescription>
              Un email sera envoyé avec un lien pour définir le mot de passe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@setupparis.fr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-nom">Nom complet</Label>
              <Input
                id="invite-nom"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                placeholder="Prénom Nom (optionnel)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "tiers")}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiers">Tiers — accès limité aux affaires invitées</SelectItem>
                  <SelectItem value="admin">Admin — accès complet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
