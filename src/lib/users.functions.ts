import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth, type AuthedContext } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, actif")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin" || !data.actif) {
    throw new Error("Accès réservé aux administrateurs");
  }
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

    // Récupère les last_sign_in_at via auth admin
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

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      nom_complet?: string;
      role: "admin" | "magasinier" | "mobile";
      redirectTo?: string;
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
        redirectTo: input.redirectTo?.trim() || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);

    const redirectTo = data.redirectTo ?? `${process.env.SITE_URL ?? ""}/reset-password`;
    const finalRedirect = redirectTo && redirectTo.startsWith("http") ? redirectTo : undefined;

    // 1. Crée le user avec un mot de passe aléatoire et email auto-confirmé.
    //    On utilise createUser plutôt que inviteUserByEmail car les emails
    //    d'invitation Supabase ne sont pas pris en charge par le hook email
    //    Lovable Cloud (seuls signup/recovery/magic_link le sont).
    const tempPassword = `Tmp_${crypto.randomUUID()}_${Date.now()}!`;
    let userId: string | null = null;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nom_complet: data.nom_complet ?? data.email },
    });

    if (createErr) {
      // Si l'utilisateur existe déjà, on récupère son id pour quand même
      // mettre à jour son profil et lui renvoyer un lien.
      const msg = createErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users.find((u) => u.email?.toLowerCase() === data.email);
        if (!existing) throw new Error(createErr.message);
        userId = existing.id;
      } else {
        throw new Error(createErr.message);
      }
    } else {
      userId = created?.user?.id ?? null;
    }

    if (!userId) throw new Error("Création du compte impossible");

    // 2. Crée / met à jour le profil avec le bon rôle
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: data.email,
        nom_complet: data.nom_complet ?? data.email,
        role: data.role,
        actif: true,
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    // 3. Envoie un lien de récupération (passe par le hook email Lovable).
    //    C'est ce flow qui sert d'invitation : l'utilisateur définit son
    //    propre mot de passe via la page /reset-password.
    const { error: recoverErr } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: finalRedirect,
    });
    if (recoverErr) throw new Error(recoverErr.message);

    return { success: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo?: string }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new Error("Email requis");
    return { email, redirectTo: input.redirectTo?.trim() || null };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as AuthedContext).supabase, (context as AuthedContext).userId);

    const redirectTo = data.redirectTo ?? `${process.env.SITE_URL ?? ""}/reset-password`;
    const finalRedirect = redirectTo && redirectTo.startsWith("http") ? redirectTo : undefined;
    // resetPasswordForEmail déclenche l'envoi via le hook email Lovable,
    // contrairement à generateLink qui se contente de créer un lien sans email.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: finalRedirect,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

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

    // Bloque aussi côté auth via ban
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
    // Supprime aussi le profil (au cas où)
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    return { success: true };
  });
