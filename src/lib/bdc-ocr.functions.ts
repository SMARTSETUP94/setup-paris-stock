import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const MINDEE_ENDPOINT = "https://api.mindee.net/v1/products/mindee/invoices/v4/predict";

type MindeeLineItem = {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  confidence: number | null;
};

type MindeePrediction = {
  supplier_name?: { value?: string | null };
  invoice_number?: { value?: string | null };
  date?: { value?: string | null };
  total_net?: { value?: number | null };
  total_amount?: { value?: number | null };
  line_items?: MindeeLineItem[];
};

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lance l'OCR Mindee sur un BDC (PDF déjà uploadé dans bdc-uploads).
 * - Vérifie l'admin via le middleware auth
 * - Télécharge le PDF (admin client → bypass RLS storage)
 * - Appelle Mindee
 * - Stocke la réponse brute, met à jour le BDC, insère les lignes
 * - Auto-match des lignes vers panneaux via pg_trgm
 */
export const ocrBdc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bdcId: string }) => {
    if (!input || typeof input.bdcId !== "string" || input.bdcId.length < 10) {
      throw new Error("bdcId invalide");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { bdcId } = data;

    // 1. Check admin
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile || profile.role !== "admin") {
      throw new Error("Accès refusé : admins uniquement");
    }

    // 2. Charger le BDC
    const { data: bdc, error: bdcErr } = await supabaseAdmin
      .from("bons_de_commande")
      .select("id, fichier_pdf_url, statut, affaire_id")
      .eq("id", bdcId)
      .maybeSingle();
    if (bdcErr) throw new Error(bdcErr.message);
    if (!bdc) throw new Error("BDC introuvable");
    if (!bdc.fichier_pdf_url) throw new Error("PDF non trouvé pour ce BDC");

    // 3. Télécharger le PDF depuis le bucket privé
    // fichier_pdf_url est stocké comme path interne du bucket (ex: "2026/04/uuid.pdf")
    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
      .from("bdc-uploads")
      .download(bdc.fichier_pdf_url);
    if (dlErr || !fileBlob) {
      throw new Error("Téléchargement du PDF échoué : " + (dlErr?.message ?? "vide"));
    }

    const MINDEE_API_KEY = process.env.MINDEE_API_KEY;
    if (!MINDEE_API_KEY) {
      throw new Error("MINDEE_API_KEY non configurée côté serveur");
    }

    // 4. Appeler Mindee Invoice V4
    const form = new FormData();
    form.append("document", fileBlob, "bdc.pdf");

    let mindeeJson: unknown = null;
    let mindeeOk = false;
    let mindeeErrorMsg: string | null = null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 55_000);
      const resp = await fetch(MINDEE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Token ${MINDEE_API_KEY}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(t);
      mindeeJson = await resp.json().catch(() => null);
      if (!resp.ok) {
        mindeeErrorMsg = `Mindee HTTP ${resp.status}`;
      } else {
        mindeeOk = true;
      }
    } catch (e) {
      mindeeErrorMsg = e instanceof Error ? e.message : "Erreur réseau lors de l'appel Mindee";
    }

    // 5. Si échec : on persiste l'erreur dans extraction_brute_json pour permettre un retry
    if (!mindeeOk) {
      await supabaseAdmin
        .from("bons_de_commande")
        .update({
          statut: "ocr_termine",
          extraction_brute_json: {
            error: mindeeErrorMsg,
            raw: mindeeJson ?? null,
          } as never,
        })
        .eq("id", bdcId);
      return {
        ok: false,
        error: mindeeErrorMsg ?? "OCR échoué",
        lignes_extraites: 0,
        lignes_matchees: 0,
      };
    }

    // 6. Parser la réponse
    const prediction = (
      (mindeeJson as Record<string, unknown> | null)?.document as
        | Record<string, unknown>
        | undefined
    )?.inference;
    const pred = (prediction as Record<string, unknown> | undefined)?.prediction as
      | MindeePrediction
      | undefined;

    const supplierName = pred?.supplier_name?.value ?? null;
    const invoiceNumber = pred?.invoice_number?.value ?? null;
    const invoiceDate = pred?.date?.value ?? null;
    const totalNet = safeNumber(pred?.total_net?.value);
    const lineItems: MindeeLineItem[] = Array.isArray(pred?.line_items) ? pred!.line_items! : [];

    // 7. Effacer les anciennes lignes (cas d'un re-OCR) puis insérer les nouvelles
    await supabaseAdmin.from("bdc_lignes").delete().eq("bdc_id", bdcId);

    type BdcUpdate = Database["public"]["Tables"]["bons_de_commande"]["Update"];
    const updates: BdcUpdate = {
      statut: "ocr_termine",
      extraction_brute_json: mindeeJson as never,
      validated_at: null,
    };
    if (totalNet !== null) updates.montant_ht_total = totalNet;
    if (invoiceNumber) updates.numero_bdc = invoiceNumber;
    if (invoiceDate) updates.date_bdc = invoiceDate;

    // Match fournisseur si possible et BDC sans fournisseur encore défini
    if (supplierName) {
      const { data: matchF } = await supabaseAdmin.rpc("match_fournisseur_par_nom", {
        _nom: supplierName,
        _seuil: 0.4,
      });
      const top = Array.isArray(matchF) && matchF.length > 0 ? matchF[0] : null;
      if (top?.fournisseur_id) {
        updates.fournisseur_id = top.fournisseur_id;
      }
    }

    await supabaseAdmin.from("bons_de_commande").update(updates).eq("id", bdcId);

    // 8. Insérer chaque ligne + tenter auto-match
    let lignesExtraites = 0;
    let lignesMatchees = 0;

    for (const li of lineItems) {
      const description = (li.description ?? "").trim();
      const quantite = safeNumber(li.quantity) ?? 0;
      const prixUnit = safeNumber(li.unit_price) ?? 0;
      let panneauId: string | null = null;

      if (description) {
        const { data: matches } = await supabaseAdmin.rpc("match_panneaux_par_description", {
          _description: description,
          _seuil: 0.3,
          _limit: 1,
        });
        const best = Array.isArray(matches) && matches.length > 0 ? matches[0] : null;
        if (best && (best.similarity ?? 0) >= 0.5) {
          panneauId = best.panneau_id ?? null;
          if (panneauId) lignesMatchees += 1;
        }
      }

      const { error: insErr } = await supabaseAdmin.from("bdc_lignes").insert({
        bdc_id: bdcId,
        matiere_libelle_brut: description || null,
        dimensions_brut: null,
        quantite,
        prix_unitaire_ht: prixUnit,
        panneau_id: panneauId,
        ligne_validee: false,
      });
      if (!insErr) lignesExtraites += 1;
    }

    return {
      ok: true,
      lignes_extraites: lignesExtraites,
      lignes_matchees: lignesMatchees,
      total_net: totalNet,
      supplier_name: supplierName,
    };
  });
