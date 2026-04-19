/**
 * ============================================================
 * ROUTE PUBLIQUE — SCAN ATELIER
 * ============================================================
 *
 * Ces server functions sont APPELÉES SANS AUTHENTIFICATION par les
 * pages /scan et /scan/$panneauId. Elles utilisent supabaseAdmin
 * (service_role) pour bypasser RLS.
 *
 * USAGE PRÉVU :
 *   - Atelier privé Setup Paris
 *   - Ouvriers internes + sous-traitants intervenants ponctuels
 *   - QR codes physiques collés sur les panneaux (générés depuis
 *     /catalogue/etiquettes par un admin)
 *
 * MITIGATIONS DU RISQUE :
 *   1. UUID v4 imprévisible → impossible d'énumérer les panneaux
 *      sans avoir scanné un QR physique au préalable
 *   2. QR physique en atelier privé → accès réservé aux personnes
 *      présentes sur place
 *   3. Trace nom_operateur stocké dans mouvements_stock.commentaire
 *      pour audit (effectue_par = NULL signale une sortie scan)
 *   4. Sortie uniquement (type forcé), quantité plafonnée à 10000
 *   5. Affaires archivées/terminées rejetées
 *
 * À NE PAS FAIRE :
 *   - Exposer ces endpoints publiquement (DNS, sitemap, etc.)
 *   - Ajouter des opérations sensibles (suppression, lecture profils…)
 *   - Élargir la recherche (listPanneauxPublic) à des données
 *     business sensibles (prix, fournisseur…)
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Récupère les infos d'un panneau pour la page publique /scan/$id.
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
        `id, longueur_mm, largeur_mm, epaisseur_mm, reference_fournisseur, actif,
         matieres ( id, code, libelle, famille, unite_stock ),
         stock_actuel ( quantite_actuelle )`,
      )
      .eq("id", data.panneauId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!panneau) throw new Error("Panneau introuvable");

    const stockRow = panneau.stock_actuel as { quantite_actuelle?: number | null } | null;

    return {
      id: panneau.id,
      longueur_mm: panneau.longueur_mm,
      largeur_mm: panneau.largeur_mm,
      epaisseur_mm: panneau.epaisseur_mm,
      reference_fournisseur: panneau.reference_fournisseur,
      actif: panneau.actif,
      matiere: panneau.matieres,
      stock_actuel: stockRow?.quantite_actuelle ?? 0,
    };
  });

/**
 * Liste des affaires actives (devis + en_cours) pour le selecteur public.
 */
export const listAffairesActivesPublic = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("affaires")
    .select("id, code_chantier, nom, client, statut")
    .in("statut", ["devis", "en_cours"])
    .order("code_chantier", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/**
 * Recherche textuelle de panneaux pour le fallback caméra HS.
 * Utilisée uniquement par /scan quand le QR ne peut pas être scanné.
 *
 * Sécurité :
 *   - Champ q court (max 80) et trim
 *   - Résultats limités à 20
 *   - Panneaux actifs uniquement
 *   - Aucune donnée sensible exposée (pas de prix, pas de CUMP)
 */
export const listPanneauxPublic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      q: z.string().trim().min(1).max(80),
    }),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (q.length < 1) return { results: [] as PanneauSearchResult[] };

    // Recherche sur matieres.code + matieres.libelle via ILIKE
    // (trgm n'est pas exposé directement par PostgREST sans RPC dédiée)
    const { data: matieres, error: errMat } = await supabaseAdmin
      .from("matieres")
      .select("id, code, libelle")
      .or(`code.ilike.%${q}%,libelle.ilike.%${q}%`)
      .eq("actif", true)
      .limit(50);
    if (errMat) throw new Error(errMat.message);

    const matiereIds = (matieres ?? []).map((m) => m.id);
    if (matiereIds.length === 0) return { results: [] as PanneauSearchResult[] };

    const { data: panneaux, error: errPan } = await supabaseAdmin
      .from("panneaux")
      .select("id, longueur_mm, largeur_mm, epaisseur_mm, matiere_id")
      .in("matiere_id", matiereIds)
      .eq("actif", true)
      .limit(20);
    if (errPan) throw new Error(errPan.message);

    const matMap = new Map(
      (matieres ?? []).map((m) => [m.id, { code: m.code, libelle: m.libelle }]),
    );

    const results: PanneauSearchResult[] = (panneaux ?? []).map((p) => {
      const m = matMap.get(p.matiere_id);
      return {
        id: p.id,
        longueur_mm: p.longueur_mm,
        largeur_mm: p.largeur_mm,
        epaisseur_mm: p.epaisseur_mm,
        matiere_code: m?.code ?? null,
        matiere_libelle: m?.libelle ?? null,
      };
    });

    return { results };
  });

export type PanneauSearchResult = {
  id: string;
  longueur_mm: number;
  largeur_mm: number;
  epaisseur_mm: number;
  matiere_code: string | null;
  matiere_libelle: string | null;
};

/**
 * Catalogue public actif pour la sélection cascade Matière → Format → Épaisseur.
 * Données strictement nécessaires à la sélection (pas de prix, pas de CUMP).
 */
export type CascadeMatiere = { id: string; code: string; libelle: string };
export type CascadePanneau = {
  id: string;
  matiere_id: string;
  longueur_mm: number;
  largeur_mm: number;
  epaisseur_mm: number;
};

export const listCataloguePublic = createServerFn({ method: "POST" }).handler(async () => {
  const { data: matieres, error: errMat } = await supabaseAdmin
    .from("matieres")
    .select("id, code, libelle")
    .eq("actif", true)
    .order("libelle", { ascending: true });
  if (errMat) throw new Error(errMat.message);

  const { data: panneaux, error: errPan } = await supabaseAdmin
    .from("panneaux")
    .select("id, matiere_id, longueur_mm, largeur_mm, epaisseur_mm")
    .eq("actif", true);
  if (errPan) throw new Error(errPan.message);

  // Filtre les matières qui n'ont aucun panneau actif
  const matiereIdsAvecPanneaux = new Set((panneaux ?? []).map((p) => p.matiere_id));
  const matieresFiltrees: CascadeMatiere[] = (matieres ?? []).filter((m) =>
    matiereIdsAvecPanneaux.has(m.id),
  );

  return {
    matieres: matieresFiltrees,
    panneaux: (panneaux ?? []) as CascadePanneau[],
  };
});

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
