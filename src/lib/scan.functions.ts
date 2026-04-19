import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Récupère les infos d'un panneau pour la page publique /scan/$id.
 * Pas d'auth : utilisé par les ouvriers atelier qui scannent un QR.
 */
export const getPanneauPublic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      panneauId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: panneau, error } = await supabaseAdmin
      .from("panneaux")
      .select(
        `id, longueur_mm, largeur_mm, reference_fournisseur, actif,
         matieres ( id, code, libelle, famille, epaisseur_mm, unite_stock ),
         stock_actuel ( quantite_actuelle )`,
      )
      .eq("id", data.panneauId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!panneau) throw new Error("Panneau introuvable");

    return {
      id: panneau.id,
      longueur_mm: panneau.longueur_mm,
      largeur_mm: panneau.largeur_mm,
      reference_fournisseur: panneau.reference_fournisseur,
      actif: panneau.actif,
      matiere: panneau.matieres,
      stock_actuel: (panneau.stock_actuel as any)?.quantite_actuelle ?? 0,
    };
  });

/**
 * Liste des affaires actives (devis + en_cours) pour le selecteur public.
 */
export const listAffairesActivesPublic = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("affaires")
      .select("id, code_chantier, nom, client, statut")
      .in("statut", ["devis", "en_cours"])
      .order("code_chantier", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

/**
 * Déclare une sortie de stock depuis un scan QR public.
 * - Pas d'auth requis (atelier privé)
 * - Type forcé à "sortie", quantité négative
 * - effectue_par = NULL, nom_operateur stocké dans commentaire
 */
export const declarerSortieScan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      panneauId: z.string().uuid(),
      affaireId: z.string().uuid(),
      quantite: z.number().positive().max(10000),
      nomOperateur: z.string().min(1).max(100),
      commentaireLibre: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Vérifier que le panneau existe et est actif
    const { data: panneau, error: ePan } = await supabaseAdmin
      .from("panneaux")
      .select("id, actif")
      .eq("id", data.panneauId)
      .maybeSingle();
    if (ePan) throw new Error(ePan.message);
    if (!panneau) throw new Error("Panneau introuvable");
    if (!panneau.actif) throw new Error("Ce panneau est désactivé");

    // Vérifier l'affaire
    const { data: affaire, error: eAff } = await supabaseAdmin
      .from("affaires")
      .select("id, statut, code_chantier, nom")
      .eq("id", data.affaireId)
      .maybeSingle();
    if (eAff) throw new Error(eAff.message);
    if (!affaire) throw new Error("Affaire introuvable");
    if (affaire.statut === "archive" || affaire.statut === "termine") {
      throw new Error("Cette affaire n'accepte plus de sorties");
    }

    const commentaire = [
      `Scan atelier · ${data.nomOperateur.trim()}`,
      data.commentaireLibre?.trim() ? data.commentaireLibre.trim() : null,
    ]
      .filter(Boolean)
      .join(" — ");

    const { data: mvt, error } = await supabaseAdmin
      .from("mouvements_stock")
      .insert({
        panneau_id: data.panneauId,
        affaire_id: data.affaireId,
        type: "sortie",
        quantite: -Math.abs(data.quantite),
        commentaire,
        effectue_par: null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: mvt.id, affaire: `${affaire.code_chantier} — ${affaire.nom}` };
  });
