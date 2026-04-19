import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsUpDown, Check } from "lucide-react";
import { formatEuro, formatNumber, uniteLabel } from "@/lib/familles";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Mode = "entree" | "sortie" | "correction";

type CatalogueRow = {
  id: string;
  matiere_id: string | null;
  matiere_code: string | null;
  matiere_libelle: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
  epaisseur_mm: number | null;
  surface_m2: number | null;
  cump_ht: number | null;
  prix_achat_ht: number | null;
  stock_actuel: number | null;
  unite_stock: Database["public"]["Enums"]["unite_stock"] | null;
};

type AffaireOption = { id: string; numero: string; nom: string };

/** Pré-remplissage utilisé pour corriger un mouvement existant. */
export type MouvementPrefill = {
  panneauId: string;
  affaireId?: string | null;
  quantite: number; // valeur absolue
  signe: "plus" | "moins";
  commentaire?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  /** Pré-sélectionne une affaire (utilisé depuis la fiche affaire) */
  presetAffaireId?: string | null;
  /** Pré-remplit le formulaire (utilisé pour corriger un mouvement existant) */
  prefill?: MouvementPrefill | null;
  isAdmin: boolean;
  userId: string | null;
  onCreated?: () => void;
}

type QuantiteUnite = "panneaux" | "m2";

export function MouvementDialog({
  open,
  onOpenChange,
  mode,
  presetAffaireId,
  prefill,
  isAdmin,
  userId,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [panneaux, setPanneaux] = useState<CatalogueRow[]>([]);
  const [affaires, setAffaires] = useState<AffaireOption[]>([]);
  const [affaireOpen, setAffaireOpen] = useState(false);

  // Cascade Matière → Format → Épaisseur
  const [matiereId, setMatiereId] = useState<string>("");
  const [formatKey, setFormatKey] = useState<string>(""); // "longueur×largeur"
  const [panneauId, setPanneauId] = useState<string>("");

  const [quantite, setQuantite] = useState<string>("");
  const [quantiteUnite, setQuantiteUnite] = useState<QuantiteUnite>("panneaux");
  const [prixUnitaire, setPrixUnitaire] = useState<string>("");
  const [affaireId, setAffaireId] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");
  const [forceOverstock, setForceOverstock] = useState(false);
  const [correctionCump, setCorrectionCump] = useState(false);
  const [signe, setSigne] = useState<"plus" | "moins">("plus");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPanneauId(prefill?.panneauId ?? "");
    setMatiereId("");
    setFormatKey("");
    setQuantite(prefill ? String(prefill.quantite) : "");
    setQuantiteUnite("panneaux");
    setPrixUnitaire("");
    setAffaireId(prefill?.affaireId ?? presetAffaireId ?? "");
    setCommentaire(prefill?.commentaire ?? "");
    setForceOverstock(false);
    setCorrectionCump(false);
    setSigne(prefill?.signe ?? "plus");

    void (async () => {
      const [pRes, aRes] = await Promise.all([
        supabase
          .from("catalogue_visible")
          .select(
            "id, matiere_id, matiere_code, matiere_libelle, longueur_mm, largeur_mm, epaisseur_mm, surface_m2, cump_ht, prix_achat_ht, stock_actuel, unite_stock",
          ),
        supabase.from("affaires").select("id, numero, nom").order("numero", { ascending: false }),
      ]);
      const rows = (pRes.data as CatalogueRow[]) ?? [];
      setPanneaux(rows);
      setAffaires((aRes.data as AffaireOption[]) ?? []);

      // Si on est en prefill (correction), on initialise la cascade depuis le panneau
      if (prefill?.panneauId) {
        const found = rows.find((r) => r.id === prefill.panneauId);
        if (found) {
          setMatiereId(found.matiere_id ?? "");
          setFormatKey(`${found.longueur_mm}x${found.largeur_mm}`);
        }
      }
      setLoading(false);
    })();
  }, [open, presetAffaireId, prefill]);

  const selectedPanneau = useMemo(
    () => panneaux.find((p) => p.id === panneauId) ?? null,
    [panneaux, panneauId],
  );
  const selectedAffaire = useMemo(
    () => affaires.find((a) => a.id === affaireId) ?? null,
    [affaires, affaireId],
  );

  // Pré-remplit le prix unitaire depuis prix_achat_ht à la sélection d'un panneau (mode entrée)
  useEffect(() => {
    if (mode === "entree" && selectedPanneau && !prixUnitaire) {
      if (selectedPanneau.prix_achat_ht !== null && selectedPanneau.prix_achat_ht !== undefined) {
        setPrixUnitaire(String(selectedPanneau.prix_achat_ht));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panneauId, mode]);

  // Liste des panneaux filtrés selon le mode (sortie : seulement stock > 0)
  const filteredPanneaux = useMemo(() => {
    if (mode === "sortie") return panneaux.filter((p) => (p.stock_actuel ?? 0) > 0);
    return panneaux;
  }, [panneaux, mode]);

  // Étape 1 : matières uniques (avec stock total pour info)
  const matieresUniques = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        libelle: string;
        nbPanneaux: number;
        stockTotal: number;
      }
    >();
    for (const p of filteredPanneaux) {
      if (!p.matiere_id) continue;
      const cur = map.get(p.matiere_id);
      if (cur) {
        cur.nbPanneaux += 1;
        cur.stockTotal += Number(p.stock_actuel ?? 0);
      } else {
        map.set(p.matiere_id, {
          id: p.matiere_id,
          code: p.matiere_code ?? "—",
          libelle: p.matiere_libelle ?? "—",
          nbPanneaux: 1,
          stockTotal: Number(p.stock_actuel ?? 0),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }, [filteredPanneaux]);

  // Étape 2 : formats disponibles pour la matière sélectionnée
  const formatsDisponibles = useMemo(() => {
    if (!matiereId) return [];
    const map = new Map<
      string,
      {
        key: string;
        longueur: number;
        largeur: number;
        surface: number | null;
        nbEpaisseurs: number;
      }
    >();
    for (const p of filteredPanneaux) {
      if (p.matiere_id !== matiereId) continue;
      const key = `${p.longueur_mm}x${p.largeur_mm}`;
      const cur = map.get(key);
      if (cur) {
        cur.nbEpaisseurs += 1;
      } else {
        map.set(key, {
          key,
          longueur: Number(p.longueur_mm ?? 0),
          largeur: Number(p.largeur_mm ?? 0),
          surface: p.surface_m2,
          nbEpaisseurs: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.longueur * b.largeur - a.longueur * a.largeur);
  }, [filteredPanneaux, matiereId]);

  // Étape 3 : épaisseurs disponibles pour matière + format
  const epaisseursDisponibles = useMemo(() => {
    if (!matiereId || !formatKey) return [];
    return filteredPanneaux
      .filter((p) => p.matiere_id === matiereId && `${p.longueur_mm}x${p.largeur_mm}` === formatKey)
      .sort((a, b) => Number(a.epaisseur_mm ?? 0) - Number(b.epaisseur_mm ?? 0));
  }, [filteredPanneaux, matiereId, formatKey]);

  // Reset cascade quand un parent change
  function onMatiereChange(id: string) {
    setMatiereId(id);
    setFormatKey("");
    setPanneauId("");
    if (mode === "entree") setPrixUnitaire("");
  }
  function onFormatChange(key: string) {
    setFormatKey(key);
    setPanneauId("");
    if (mode === "entree") setPrixUnitaire("");
  }
  function onEpaisseurChange(id: string) {
    setPanneauId(id);
    if (mode === "entree") setPrixUnitaire("");
  }

  // Conversions panneaux ↔ m²
  const surfaceUnitaire = Number(selectedPanneau?.surface_m2 ?? 0);
  const qteSaisie = Number(quantite.replace(",", "."));
  // qteEnM2 = ce qui sera réellement stocké en BDD (l'unité de stock est m²)
  const qteEnM2 = useMemo(() => {
    if (!Number.isFinite(qteSaisie) || qteSaisie <= 0) return 0;
    if (quantiteUnite === "m2") return qteSaisie;
    if (surfaceUnitaire > 0) return qteSaisie * surfaceUnitaire;
    return qteSaisie;
  }, [qteSaisie, quantiteUnite, surfaceUnitaire]);
  const qteEnPanneaux = useMemo(() => {
    if (!Number.isFinite(qteSaisie) || qteSaisie <= 0) return 0;
    if (quantiteUnite === "panneaux") return qteSaisie;
    if (surfaceUnitaire > 0) return qteSaisie / surfaceUnitaire;
    return 0;
  }, [qteSaisie, quantiteUnite, surfaceUnitaire]);

  const prixNum = Number(prixUnitaire.replace(",", "."));
  const stockActuel = Number(selectedPanneau?.stock_actuel ?? 0);
  const stockEnPanneaux = surfaceUnitaire > 0 ? stockActuel / surfaceUnitaire : 0;
  const cumpActuel = selectedPanneau?.cump_ht ?? null;

  // Calculs aperçu (basés sur qteEnM2 et prix €/m²)
  const apercu = useMemo(() => {
    if (!selectedPanneau || qteEnM2 <= 0) return null;
    if (mode === "entree" && Number.isFinite(prixNum) && prixNum >= 0) {
      const cumpAct = cumpActuel ?? 0;
      const newCump =
        stockActuel <= 0 || cumpActuel === null
          ? prixNum
          : (stockActuel * cumpAct + qteEnM2 * prixNum) / (stockActuel + qteEnM2);
      return {
        kind: "entree" as const,
        valeur: qteEnM2 * prixNum,
        nouveauCump: newCump,
        nouveauStock: stockActuel + qteEnM2,
      };
    }
    if (mode === "sortie") {
      const cumpAct = cumpActuel ?? 0;
      return {
        kind: "sortie" as const,
        valeur: qteEnM2 * cumpAct,
        nouveauCump: cumpAct,
        nouveauStock: stockActuel - qteEnM2,
      };
    }
    return null;
  }, [mode, qteEnM2, prixNum, stockActuel, cumpActuel, selectedPanneau]);

  const overstock = mode === "sortie" && qteEnM2 > stockActuel;

  async function submit() {
    if (!selectedPanneau) {
      toast.error("Sélectionnez un panneau (matière, format, épaisseur)");
      return;
    }
    if (!Number.isFinite(qteSaisie) || qteSaisie <= 0 || qteEnM2 <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    if (mode === "entree" && (!Number.isFinite(prixNum) || prixNum < 0)) {
      toast.error("Prix unitaire HT requis pour calculer le CUMP");
      return;
    }
    if (mode === "sortie" && !affaireId) {
      toast.error("Affaire obligatoire pour une sortie");
      return;
    }
    if (mode === "sortie" && overstock && !isAdmin) {
      toast.error("Quantité supérieure au stock disponible");
      return;
    }
    if (mode === "sortie" && overstock && isAdmin && !forceOverstock) {
      toast.error(
        `Stock disponible : ${formatNumber(stockActuel, 2)} m². Cochez « Forcer » pour valider.`,
      );
      return;
    }
    if (mode === "correction" && !commentaire.trim()) {
      toast.error("Commentaire obligatoire pour une correction");
      return;
    }

    setSubmitting(true);

    let typeMvt: Database["public"]["Enums"]["type_mouvement"] = "entree";
    let signedQte = qteEnM2;
    let prix: number | null = null;
    let comment = commentaire.trim() || null;

    if (mode === "entree") {
      typeMvt = "entree";
      signedQte = qteEnM2;
      prix = prixNum;
    } else if (mode === "sortie") {
      typeMvt = "sortie";
      signedQte = -qteEnM2;
    } else {
      typeMvt = "correction";
      signedQte = signe === "moins" ? -qteEnM2 : qteEnM2;
      if (correctionCump) {
        comment = `${comment ?? ""} #correction_cump`.trim();
        if (Number.isFinite(prixNum) && prixNum >= 0) prix = prixNum;
      }
    }

    const payload: Database["public"]["Tables"]["mouvements_stock"]["Insert"] = {
      panneau_id: selectedPanneau.id,
      type: typeMvt,
      quantite: signedQte,
      prix_unitaire_ht: prix,
      affaire_id: affaireId || null,
      commentaire: comment,
      effectue_par: userId,
    };

    const { error } = await supabase.from("mouvements_stock").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const labels: Record<Mode, string> = {
      entree: "Entrée enregistrée",
      sortie: "Sortie enregistrée",
      correction: "Correction enregistrée",
    };
    toast.success(labels[mode]);
    onCreated?.();
    onOpenChange(false);
  }

  const titles: Record<Mode, string> = {
    entree: "Nouvelle entrée",
    sortie: "Nouvelle sortie",
    correction: "Correction de stock",
  };

  // Format affichage pour le format (longueur × largeur + surface)
  function fmtFormat(f: { longueur: number; largeur: number; surface: number | null }) {
    const dim = `${f.longueur}×${f.largeur} mm`;
    if (f.surface && f.surface > 0) return `${dim} · ${formatNumber(f.surface, 3)} m²`;
    return dim;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          {mode === "correction" && (
            <DialogDescription>
              Une correction est immuable. Pour annuler une sortie erronée, créez une correction
              positive.
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Cascade Matière → Format → Épaisseur */}
            <div className="grid gap-3">
              {/* Matière */}
              <div>
                <Label>Matière *</Label>
                <MatiereCombobox
                  matieres={matieresUniques}
                  value={matiereId}
                  onChange={onMatiereChange}
                />
              </div>

              {/* Format */}
              <div>
                <Label>
                  Format *{" "}
                  <span className="text-xs text-muted-foreground ml-1">(longueur × largeur)</span>
                </Label>
                <Select
                  value={formatKey}
                  onValueChange={onFormatChange}
                  disabled={!matiereId || formatsDisponibles.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !matiereId
                          ? "Choisir une matière d'abord"
                          : formatsDisponibles.length === 0
                            ? "Aucun format disponible"
                            : "Sélectionner un format…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formatsDisponibles.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {fmtFormat(f)}{" "}
                        <span className="text-muted-foreground">
                          · {f.nbEpaisseurs} épaisseur{f.nbEpaisseurs > 1 ? "s" : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Épaisseur */}
              <div>
                <Label>Épaisseur *</Label>
                <Select
                  value={panneauId}
                  onValueChange={onEpaisseurChange}
                  disabled={!formatKey || epaisseursDisponibles.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !formatKey
                          ? "Choisir un format d'abord"
                          : epaisseursDisponibles.length === 0
                            ? "Aucune épaisseur disponible"
                            : "Sélectionner une épaisseur…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {epaisseursDisponibles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.epaisseur_mm} mm
                        <span className="text-muted-foreground">
                          {" "}
                          · stock {formatNumber(Number(p.stock_actuel ?? 0), 2)} m²
                          {p.surface_m2 && p.surface_m2 > 0
                            ? ` (${formatNumber(Number(p.stock_actuel ?? 0) / Number(p.surface_m2), 1)} pann.)`
                            : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantité avec toggle unité */}
            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "correction" && (
                <div className="sm:col-span-2">
                  <Label>Sens</Label>
                  <Select value={signe} onValueChange={(v) => setSigne(v as "plus" | "moins")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plus">+ (ajouter au stock)</SelectItem>
                      <SelectItem value="moins">− (retirer du stock)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="mb-0">Quantité *</Label>
                  <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setQuantiteUnite("panneaux")}
                      className={cn(
                        "px-2.5 py-1 transition-colors",
                        quantiteUnite === "panneaux"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-muted text-muted-foreground",
                      )}
                    >
                      Panneaux
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantiteUnite("m2")}
                      className={cn(
                        "px-2.5 py-1 transition-colors border-l border-border",
                        quantiteUnite === "m2"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-muted text-muted-foreground",
                      )}
                    >
                      m²
                    </button>
                  </div>
                </div>
                <Input
                  type="number"
                  step={quantiteUnite === "panneaux" ? "1" : "0.01"}
                  min="0"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  placeholder={quantiteUnite === "panneaux" ? "ex : 5" : "ex : 15.25"}
                />
                {selectedPanneau && qteSaisie > 0 && surfaceUnitaire > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {quantiteUnite === "panneaux"
                      ? `≈ ${formatNumber(qteEnM2, 2)} m²`
                      : `≈ ${formatNumber(qteEnPanneaux, 2)} panneau${qteEnPanneaux > 1 ? "x" : ""}`}
                  </p>
                )}
              </div>
              {(mode === "entree" || (mode === "correction" && correctionCump)) && (
                <div>
                  <Label>
                    Prix unitaire HT (€/m²) {mode === "entree" && "*"}
                    {selectedPanneau && surfaceUnitaire > 0 && Number.isFinite(prixNum) && prixNum > 0 && (
                      <span className="text-xs text-muted-foreground ml-1 font-normal">
                        ≈ {formatEuro(prixNum * surfaceUnitaire)}/panneau
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={prixUnitaire}
                    onChange={(e) => setPrixUnitaire(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            {/* Affaire */}
            <div>
              <Label>Affaire {mode === "sortie" && "*"}</Label>
              <Popover open={affaireOpen} onOpenChange={setAffaireOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                    disabled={!!presetAffaireId}
                  >
                    <span className={cn("truncate", !selectedAffaire && "text-muted-foreground")}>
                      {selectedAffaire ? (
                        <>
                          <span className="font-mono text-xs mr-2">{selectedAffaire.numero}</span>
                          {selectedAffaire.nom}
                        </>
                      ) : mode === "sortie" ? (
                        "Sélectionner une affaire…"
                      ) : (
                        "— Aucune (stock général)"
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher numéro ou nom…" />
                    <CommandList>
                      <CommandEmpty>Aucune affaire.</CommandEmpty>
                      <CommandGroup>
                        {mode !== "sortie" && (
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setAffaireId("");
                              setAffaireOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !affaireId ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="text-muted-foreground">— Aucune (stock général)</span>
                          </CommandItem>
                        )}
                        {affaires.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.numero} ${a.nom}`}
                            onSelect={() => {
                              setAffaireId(a.id);
                              setAffaireOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                affaireId === a.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="font-mono text-xs mr-2">{a.numero}</span>
                            <span className="flex-1 truncate">{a.nom}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Commentaire */}
            <div>
              <Label>Commentaire {mode === "correction" && "*"}</Label>
              <Textarea
                rows={mode === "correction" ? 3 : 2}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder={
                  mode === "correction"
                    ? "Motif de la correction — inventaire physique, casse, perte…"
                    : "Optionnel"
                }
              />
            </div>

            {mode === "correction" && (
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={correctionCump}
                  onChange={(e) => setCorrectionCump(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  C'est aussi une correction du CUMP
                  <span className="block text-xs text-muted-foreground">
                    Saisir le nouveau prix unitaire de référence dans le champ prix.
                  </span>
                </span>
              </label>
            )}

            {/* Aperçu */}
            {selectedPanneau && (
              <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock actuel</span>
                  <span className="font-medium">
                    {formatNumber(stockActuel, 2)} {uniteLabel(selectedPanneau.unite_stock)}
                    {surfaceUnitaire > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({formatNumber(stockEnPanneaux, 1)} pann.)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CUMP actuel</span>
                  <span className="font-medium">
                    {cumpActuel === null ? "—" : `${formatEuro(cumpActuel)}/m²`}
                  </span>
                </div>
                {apercu && (
                  <>
                    <div className="border-t border-border my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantité</span>
                      <span className="font-medium">
                        {formatNumber(qteEnPanneaux, 2)} pann. ·{" "}
                        {formatNumber(qteEnM2, 2)} m²
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur ligne HT</span>
                      <span className="font-semibold text-foreground">
                        {formatEuro(apercu.valeur)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {apercu.kind === "entree" ? "Nouveau CUMP" : "CUMP après"}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatEuro(apercu.nouveauCump)}/m²
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock après</span>
                      <span
                        className={cn(
                          "font-semibold",
                          apercu.nouveauStock < 0 && "text-destructive",
                        )}
                      >
                        {formatNumber(apercu.nouveauStock, 2)}{" "}
                        {uniteLabel(selectedPanneau.unite_stock)}
                        {surfaceUnitaire > 0 && (
                          <span className="text-muted-foreground ml-1 font-normal">
                            ({formatNumber(apercu.nouveauStock / surfaceUnitaire, 1)} pann.)
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === "sortie" && overstock && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                <p className="font-medium text-warning">
                  Quantité supérieure au stock disponible ({formatNumber(stockActuel, 2)} m²).
                </p>
                {isAdmin ? (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer text-warning">
                    <input
                      type="checkbox"
                      checked={forceOverstock}
                      onChange={(e) => setForceOverstock(e.target.checked)}
                    />
                    <span>Forcer (admin)</span>
                  </label>
                ) : (
                  <p className="mt-1 text-warning">
                    Action interdite. Contactez un administrateur.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || loading}>
            {submitting
              ? "Enregistrement…"
              : mode === "entree"
                ? "Enregistrer l'entrée"
                : mode === "sortie"
                  ? "Enregistrer la sortie"
                  : "Enregistrer la correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Combobox dédié à la sélection de matière (recherche libre). */
function MatiereCombobox({
  matieres,
  value,
  onChange,
}: {
  matieres: Array<{
    id: string;
    code: string;
    libelle: string;
    nbPanneaux: number;
    stockTotal: number;
  }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = matieres.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? (
              <>
                <span className="font-mono text-xs">{selected.code}</span>
                {" — "}
                {selected.libelle}
              </>
            ) : (
              "Rechercher une matière…"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher code ou libellé…" />
          <CommandList>
            <CommandEmpty>Aucune matière trouvée.</CommandEmpty>
            <CommandGroup>
              {matieres.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.code} ${m.libelle}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="font-mono text-xs mr-2">{m.code}</span>
                  <span className="flex-1 truncate">{m.libelle}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {m.nbPanneaux} variante{m.nbPanneaux > 1 ? "s" : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
