/**
 * Server functions admin pour la "Danger zone" des paramètres.
 *
 * - exportRawMouvements : dump brut des mouvements_stock (sauvegarde avant reset)
 * - resetDonneesMetier  : appel de la fonction SQL admin_reset_donnees_metier()
 *
 * Toutes deux nécessitent un utilisateur admin authentifié (vérif côté SQL aussi
 * via is_admin(auth.uid())).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: ReturnType<typeof Object>) {
  // requireSupabaseAuth fournit déjà userId. On vérifie le rôle côté DB.
  // @ts-expect-error -- supabase client typé via middleware
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (supabase as { auth: { _user_id?: string } }).auth?._user_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") {
    throw new Error("Accès refusé : action réservée aux administrateurs");
  }
}

/**
 * Exporte la totalité de la table mouvements_stock pour sauvegarde avant reset.
 * Retourne un tableau de lignes brutes (toutes colonnes), enrichi de quelques
 * libellés utiles (matière, affaire) pour relire le CSV facilement.
 */
export const exportRawMouvements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Vérif admin
    const { data: profile, error: ePro } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (ePro) throw new Error(ePro.message);
    if (profile?.role !== "admin") {
      throw new Error("Accès refusé : action réservée aux administrateurs");
    }

    const { data, error } = await supabase
      .from("mouvements_stock")
      .select(
        `id, created_at, type, quantite, prix_unitaire_ht, cump_avant, cump_apres,
         valeur_ligne_ht, commentaire, photo_url, panneau_id, affaire_id, bdc_id, effectue_par,
         panneaux ( reference_fournisseur, longueur_mm, largeur_mm, epaisseur_mm,
                    matieres ( code, libelle ) ),
         affaires ( code_chantier, nom )`,
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { rows: data ?? [] };
  });

/**
 * Reset complet des données métier. Vérification admin doublée :
 * - Côté JS via le profil
 * - Côté SQL via is_admin(auth.uid()) dans la fonction
 */
export const resetDonneesMetier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: ePro } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (ePro) throw new Error(ePro.message);
    if (profile?.role !== "admin") {
      throw new Error("Accès refusé : action réservée aux administrateurs");
    }

    const { data, error } = await supabase.rpc("admin_reset_donnees_metier");
    if (error) throw new Error(error.message);
    return data as {
      mouvements_supprimes: number;
      lignes_bdc_supprimees: number;
      bdc_supprimes: number;
      affaires_supprimees: number;
    };
  });
