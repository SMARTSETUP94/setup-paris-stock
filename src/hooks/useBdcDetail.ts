import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ocrBdc } from "@/lib/bdc-ocr.functions";
import { toast } from "sonner";
import type {
  BdcDetail,
  LigneRow,
  PanneauOption,
  Fournisseur,
  Affaire,
} from "@/components/bdc/types";

export function useBdcDetail(id: string, ready: boolean, userId: string | undefined) {
  const ocrFn = useServerFn(ocrBdc);

  const [bdc, setBdc] = useState<BdcDetail | null>(null);
  const [lignes, setLignes] = useState<LigneRow[]>([]);
  const [panneaux, setPanneaux] = useState<PanneauOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reocrLoading, setReocrLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [confidenceByLigne, setConfidenceByLigne] = useState<Record<number, number | null>>({});

  async function load() {
    setLoading(true);
    const [bRes, lRes, pRes, fRes, aRes] = await Promise.all([
      supabase.from("bons_de_commande").select("*").eq("id", id).maybeSingle(),
      supabase.from("bdc_lignes").select("*").eq("bdc_id", id).order("id"),
      supabase
        .from("catalogue_visible")
        .select("id, matiere_code, matiere_libelle, longueur_mm, largeur_mm, cump_ht"),
      supabase.from("fournisseurs").select("id, nom").order("nom"),
      supabase.from("affaires").select("id, code_chantier, nom").order("code_chantier"),
    ]);
    setBdc(bRes.data as BdcDetail);
    setLignes((lRes.data as LigneRow[]) ?? []);
    setPanneaux((pRes.data as PanneauOption[]) ?? []);
    setFournisseurs((fRes.data as Fournisseur[]) ?? []);
    setAffaires((aRes.data as Affaire[]) ?? []);

    if (bRes.data?.fichier_pdf_url) {
      const { data: signed } = await supabase.storage
        .from("bdc-uploads")
        .createSignedUrl(bRes.data.fichier_pdf_url, 3600);
      setPdfUrl(signed?.signedUrl ?? null);
    }

    const raw = bRes.data?.extraction_brute_json as {
      document?: { inference?: { prediction?: { line_items?: { confidence?: number | null }[] } } };
    } | null;
    const items = raw?.document?.inference?.prediction?.line_items;
    if (Array.isArray(items)) {
      const map: Record<number, number | null> = {};
      items.forEach((it, i) => {
        map[i] = it?.confidence ?? null;
      });
      setConfidenceByLigne(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  // Realtime
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`bdc-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bons_de_commande", filter: `id=eq.${id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  function updateLigne(ligneId: string, patch: Partial<LigneRow>) {
    setLignes((prev) => prev.map((l) => (l.id === ligneId ? { ...l, ...patch } : l)));
  }

  function removeLigne(ligneId: string) {
    setLignes((prev) => prev.filter((l) => l.id !== ligneId));
  }

  async function addLigneVide() {
    const { data, error } = await supabase
      .from("bdc_lignes")
      .insert({
        bdc_id: id,
        matiere_libelle_brut: null,
        quantite: 1,
        prix_unitaire_ht: 0,
        ligne_validee: false,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    setLignes((prev) => [...prev, data as LigneRow]);
  }

  const totalCalcule = useMemo(
    () =>
      lignes
        .filter((l) => l.ligne_validee)
        .reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire_ht), 0),
    [lignes],
  );

  const ecartTotal = bdc?.montant_ht_total
    ? Math.abs((totalCalcule - Number(bdc.montant_ht_total)) / Number(bdc.montant_ht_total))
    : 0;

  async function handleHeaderUpdate(
    patch: Partial<
      Pick<BdcDetail, "fournisseur_id" | "numero_bdc" | "date_bdc" | "affaire_id" | "montant_ht_total">
    >,
  ) {
    if (!bdc) return;
    setBdc({ ...bdc, ...patch });
    const { error } = await supabase.from("bons_de_commande").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function handleSaveLigne(ligne: LigneRow) {
    const { error } = await supabase
      .from("bdc_lignes")
      .update({
        panneau_id: ligne.panneau_id,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        ligne_validee: ligne.ligne_validee,
      })
      .eq("id", ligne.id);
    if (error) toast.error(error.message);
  }

  async function deleteLigneInDb(ligneId: string) {
    const { error } = await supabase.from("bdc_lignes").delete().eq("id", ligneId);
    if (error) toast.error(error.message);
    else removeLigne(ligneId);
  }

  async function handleRelaunchOcr() {
    setReocrLoading(true);
    try {
      const result = await ocrFn({ data: { bdcId: id } });
      if (result.ok) {
        toast.success(`OCR relancé : ${result.lignes_extraites} ligne(s)`);
        await load();
      } else {
        toast.error(`OCR échoué : ${result.error}`);
      }
    } catch (e) {
      toast.error("Erreur OCR : " + (e instanceof Error ? e.message : "inconnue"));
    } finally {
      setReocrLoading(false);
    }
  }

  /**
   * Bascule un BDC dont l'OCR a échoué vers la saisie manuelle :
   * efface le champ error de extraction_brute_json et autorise l'édition.
   */
  async function switchToManual() {
    if (!bdc) return;
    const current = (bdc.extraction_brute_json as Record<string, unknown> | null) ?? {};
    const next = { ...current, mode: "manuel", saisie_manuelle: true };
    delete (next as Record<string, unknown>).error;

    const { error } = await supabase
      .from("bons_de_commande")
      .update({
        extraction_brute_json: next,
        statut: bdc.statut === "en_attente_ocr" ? "ocr_termine" : (bdc.statut as "ocr_termine"),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mode saisie manuelle activé. Vous pouvez ajouter vos lignes.");
    await load();
  }

  async function handleValider(onSuccess: () => void) {
    if (!bdc) return;
    const lignesAValider = lignes.filter((l) => l.ligne_validee && l.panneau_id);
    if (lignesAValider.length === 0) {
      toast.error("Cochez au moins une ligne avec un panneau associé.");
      return;
    }

    setValidating(true);
    for (const l of lignesAValider) {
      await supabase
        .from("bdc_lignes")
        .update({
          panneau_id: l.panneau_id,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          ligne_validee: true,
        })
        .eq("id", l.id);
    }

    let okCount = 0;
    for (const l of lignesAValider) {
      const { error } = await supabase.from("mouvements_stock").insert({
        panneau_id: l.panneau_id!,
        type: "entree",
        quantite: Number(l.quantite),
        prix_unitaire_ht: Number(l.prix_unitaire_ht),
        affaire_id: bdc.affaire_id,
        bdc_id: id,
        effectue_par: userId ?? null,
        commentaire: `BDC ${bdc.numero_bdc ?? ""}`.trim(),
      });
      if (error) {
        toast.error(`Ligne « ${l.matiere_libelle_brut ?? ""} » : ${error.message}`);
      } else {
        okCount += 1;
      }
    }

    if (okCount > 0) {
      await supabase
        .from("bons_de_commande")
        .update({ statut: "valide", validated_at: new Date().toISOString() })
        .eq("id", id);
      toast.success(`${okCount} entrée(s) de stock créée(s). CUMP recalculé.`);
      onSuccess();
    }

    setValidating(false);
  }

  async function handleAnnuler(onSuccess: () => void) {
    await supabase.from("bons_de_commande").update({ statut: "annule" }).eq("id", id);
    toast.success("BDC annulé");
    onSuccess();
  }

  return {
    bdc,
    setBdc,
    lignes,
    panneaux,
    fournisseurs,
    affaires,
    pdfUrl,
    loading,
    reocrLoading,
    validating,
    confidenceByLigne,
    totalCalcule,
    ecartTotal,
    updateLigne,
    addLigneVide,
    handleHeaderUpdate,
    handleSaveLigne,
    deleteLigneInDb,
    handleRelaunchOcr,
    switchToManual,
    handleValider,
    handleAnnuler,
  };
}
