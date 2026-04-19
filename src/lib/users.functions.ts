import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth, type AuthedContext } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailServer, getAppBaseUrl } from "@/lib/email.functions";
import { inviteAdminTemplate, passwordResetTemplate } from "@/lib/email-templates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  magasinier: "Magasinier",
  mobile: "Mobile",
};

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, actif, nom_complet, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin" || !data.actif) {
    throw new Error("Accès réservé aux administrateurs");
  }
  return data;
}

function newToken(): string {
  // 32 bytes hex = 64 chars, compact et sûr
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nom_complet, role, actif, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const authMap = new Map(
      (authUsers?.users ?? []).map((u) => [
        u.id,
        {
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
        },
      ]),
    );

    return {
      users: (profiles ?? []).map((p) => ({
        ...p,
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
        email_confirmed_at: authMap.get(p.id)?.email_confirmed_at ?? null,
      })),
    };
  });

// ---------------------------------------------------------------------------
// Invitation : on crée juste un token + on envoie l'email Resend.
// Le user Supabase Auth sera créé à l'acceptation (acceptInvite).
// ---------------------------------------------------------------------------
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      nom_complet?: string;
      role: "admin" | "magasinier" | "mobile";
    }) => {
      const email = input.email?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Email invalide");
      }
      if (input.role !== "admin" && input.role !== "magasinier" && input.role !== "mobile") {
        throw new Error("Rôle invalide");
      }
      return {
        email,
        nom_complet: input.nom_complet?.trim() || null,
        role: input.role,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const inviter = await assertAdmin(
      (context as AuthedContext).supabase,
      (context as AuthedContext).userId,
    );

    // Si un user existe déjà avec cet email → on lui envoie un reset à la place.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === data.email);

    if (existing) {
      // Cas existant : on envoie un password reset custom (pas une invitation).
      const token = newToken();
      const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h

      const { error: insErr } = await supabaseAdmin.from("invitations").insert({
        email: data.email,
        token,
        kind: "password_reset",
        role: data.role,
        nom_complet: data.nom_complet,
        inviter_id: (context as AuthedContext).userId,
        expire_at: expireAt,
      });
      if (insErr) throw new Error(insErr.message);

      const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token}`;
      const tpl = passwordResetTemplate({ resetUrl });
      await sendEmailServer({ to: data.email, subject: tpl.subject, html: tpl.html, text: tpl.text });

      return { success: true, mode: "reset_existing" as const };
    }

    // Nouvelle invitation
    const token = newToken();
    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7j

    const { error: insErr } = await supabaseAdmin.from("invitations").insert({
      email: data.email,
      token,
      kind: "invite_admin",
      role: data.role,
      nom_complet: data.nom_complet,
      inviter_id: (context as AuthedContext).userId,
      expire_at: expireAt,
    });
    if (insErr) throw new Error(insErr.message);

    const inviteUrl = `${getAppBaseUrl()}/invite?token=${token}`;
    const tpl = inviteAdminTemplate({
      inviterName: inviter.nom_complet || inviter.email || "Un administrateur",
      inviteUrl,
      roleLabel: ROLE_LABELS[data.role],
    });
    await sendEmailServer({ to: data.email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    return { success: true, mode: "invited" as const };
  });

// ---------------------------------------------------------------------------
// Renvoyer un lien (reset password pour un user existant)
// ---------------------------------------------------------------------------
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new Error("Email requis");
    return { email };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);

    const token = newToken();
    const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("invitations").insert({
      email: data.email,
      token,
      kind: "password_reset",
      inviter_id: (context as AuthedContext).userId,
      expire_at: expireAt,
    });
    if (insErr) throw new Error(insErr.message);

    const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token}`;
    const tpl = passwordResetTemplate({ resetUrl });
    await sendEmailServer({ to: data.email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    return { success: true };
  });

// ---------------------------------------------------------------------------
// Demande de reset depuis /login (publique — pas de middleware auth)
// ---------------------------------------------------------------------------
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email invalide");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    // On ne révèle pas si l'email existe (anti-énumération).
    // Mais on n'envoie réellement l'email que si le user existe.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === data.email);

    if (existing) {
      const token = newToken();
      const expireAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const { error: insErr } = await supabaseAdmin.from("invitations").insert({
        email: data.email,
        token,
        kind: "password_reset",
        expire_at: expireAt,
      });
      if (insErr) throw new Error(insErr.message);

      const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token}`;
      const tpl = passwordResetTemplate({ resetUrl });
      await sendEmailServer({
        to: data.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    }

    return { success: true };
  });

// ---------------------------------------------------------------------------
// Inspection d'un token (public) — utilisé par /invite et /reset-password
// ---------------------------------------------------------------------------
export const inspectToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (!input.token || input.token.length < 8) throw new Error("Token invalide");
    return { token: input.token };
  })
  .handler(async ({ data }) => {
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, kind, role, nom_complet, expire_at, used_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) return { valid: false as const, reason: "not_found" as const };
    if (inv.used_at) return { valid: false as const, reason: "used" as const };
    if (new Date(inv.expire_at).getTime() < Date.now()) {
      return { valid: false as const, reason: "expired" as const };
    }
    return {
      valid: true as const,
      email: inv.email,
      kind: inv.kind as "invite_admin" | "password_reset",
      nom_complet: inv.nom_complet,
    };
  });

// ---------------------------------------------------------------------------
// Acceptation d'invitation (public) : crée le user + définit son mot de passe
// ---------------------------------------------------------------------------
export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) => {
    if (!input.token) throw new Error("Token requis");
    if (!input.password || input.password.length < 8) {
      throw new Error("Mot de passe : 8 caractères minimum");
    }
    return { token: input.token, password: input.password };
  })
  .handler(async ({ data }) => {
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, kind, role, nom_complet, expire_at, used_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation introuvable");
    if (inv.used_at) throw new Error("Cette invitation a déjà été utilisée");
    if (new Date(inv.expire_at).getTime() < Date.now()) throw new Error("Invitation expirée");
    if (inv.kind !== "invite_admin") throw new Error("Type de jeton invalide pour cette action");

    const role = (inv.role ?? "mobile") as "admin" | "magasinier" | "mobile";

    // Crée le user Supabase Auth (email auto-confirmé)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nom_complet: inv.nom_complet ?? inv.email },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created?.user?.id;
    if (!userId) throw new Error("Création du compte impossible");

    // Force le profil avec le bon rôle (le trigger handle_new_user crée déjà
    // une ligne, on l'écrase pour appliquer le rôle de l'invitation).
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: inv.email,
        nom_complet: inv.nom_complet ?? inv.email,
        role,
        actif: true,
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    // Marque l'invitation comme utilisée
    await supabaseAdmin
      .from("invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { success: true, email: inv.email };
  });

// ---------------------------------------------------------------------------
// Reset password (public) : applique un nouveau mot de passe à partir du token
// ---------------------------------------------------------------------------
export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) => {
    if (!input.token) throw new Error("Token requis");
    if (!input.password || input.password.length < 8) {
      throw new Error("Mot de passe : 8 caractères minimum");
    }
    return { token: input.token, password: input.password };
  })
  .handler(async ({ data }) => {
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, kind, expire_at, used_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Lien introuvable");
    if (inv.used_at) throw new Error("Ce lien a déjà été utilisé");
    if (new Date(inv.expire_at).getTime() < Date.now()) throw new Error("Lien expiré");
    if (inv.kind !== "password_reset") throw new Error("Type de jeton invalide pour cette action");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === inv.email.toLowerCase());
    if (!existing) throw new Error("Compte introuvable");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: data.password,
    });
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin
      .from("invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { success: true, email: inv.email };
  });

// ---------------------------------------------------------------------------
// Désactiver / réactiver un compte
// ---------------------------------------------------------------------------
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; actif: boolean }) => {
    if (!input.user_id) throw new Error("user_id requis");
    return { user_id: input.user_id, actif: !!input.actif };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);
    if (data.user_id === (context as AuthedContext).userId && !data.actif) {
      throw new Error("Vous ne pouvez pas vous désactiver vous-même");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ actif: data.actif })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.actif ? "none" : "876000h",
    });
    return { success: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: "admin" | "magasinier" | "mobile" }) => {
    if (!input.user_id) throw new Error("user_id requis");
    if (input.role !== "admin" && input.role !== "magasinier" && input.role !== "mobile") {
      throw new Error("Rôle invalide");
    }
    return { user_id: input.user_id, role: input.role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);
    if (data.user_id === (context as AuthedContext).userId && data.role !== "admin") {
      throw new Error("Vous ne pouvez pas vous retirer le rôle admin vous-même");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input.user_id) throw new Error("user_id requis");
    return { user_id: input.user_id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);
    if (data.user_id === (context as AuthedContext).userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    return { success: true };
  });
