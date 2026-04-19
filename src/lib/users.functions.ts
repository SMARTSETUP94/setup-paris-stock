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
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nom_complet: data.nom_complet ?? data.email },
      redirectTo: redirectTo && redirectTo.startsWith("http") ? redirectTo : undefined,
    });
    if (error) throw new Error(error.message);
    if (!invited?.user) throw new Error("Invitation échouée");

    // Crée / met à jour le profil avec le bon rôle
    await supabaseAdmin.from("profiles").upsert(
      {
        id: invited.user.id,
        email: data.email,
        nom_complet: data.nom_complet ?? data.email,
        role: data.role,
        actif: true,
      },
      { onConflict: "id" },
    );

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
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: {
        redirectTo: redirectTo && redirectTo.startsWith("http") ? redirectTo : undefined,
      },
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
