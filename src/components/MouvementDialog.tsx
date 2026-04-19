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
  matiere_code: string | null;
  matiere_libelle: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
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
  const [panneauOpen, setPanneauOpen] = useState(false);
  const [affaireOpen, setAffaireOpen] = useState(false);

  const [panneauId, setPanneauId] = useState<string>("");
  const [quantite, setQuantite] = useState<string>("");
  const [prixUnitaire, setPrixUnitaire] = useState<string>("");
  const [affaireId, setAffaireId] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");
  const [forceOverstock, setForceOverstock] = useState(false);
  const [correctionCump, setCorrectionCump] = useState(false);
  const [signe, setSigne] = useState<"plus" | "moins">("plus");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPanneauId("");
    setQuantite("");
    setPrixUnitaire("");
    setAffaireId(presetAffaireId ?? "");
    setCommentaire("");
    setForceOverstock(false);
    setCorrectionCump(false);
    setSigne("plus");

    void (async () => {
      const [pRes, aRes] = await Promise.all([
        supabase
          .from("catalogue_visible")
          .select(
            "id, matiere_code, matiere_libelle, longueur_mm, largeur_mm, cump_ht, prix_achat_ht, stock_actuel, unite_stock",
          ),
        supabase.from("affaires").select("id, numero, nom").order("numero", { ascending: false }),
      ]);
      setPanneaux((pRes.data as CatalogueRow[]) ?? []);
      setAffaires((aRes.data as AffaireOption[]) ?? []);
      setLoading(false);
    })();
  }, [open, presetAffaireId]);

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

  const filteredPanneauxForList = useMemo(() => {
    if (mode === "sortie") return panneaux.filter((p) => (p.stock_actuel ?? 0) > 0);
    return panneaux;
  }, [panneaux, mode]);

  const qteNum = Number(quantite.replace(",", "."));
  const prixNum = Number(prixUnitaire.replace(",", "."));
  const stockActuel = Number(selectedPanneau?.stock_actuel ?? 0);
  const cumpActuel = selectedPanneau?.cump_ht ?? null;

  // Calculs aperçu
  const apercu = useMemo(() => {
    if (!selectedPanneau || !Number.isFinite(qteNum) || qteNum <= 0) return null;
    if (mode === "entree" && Number.isFinite(prixNum) && prixNum >= 0) {
      const cumpAct = cumpActuel ?? 0;
      const newCump =
        stockActuel <= 0 || cumpActuel === null
          ? prixNum
          : (stockActuel * cumpAct + qteNum * prixNum) / (stockActuel + qteNum);
      return {
        kind: "entree" as const,
        valeur: qteNum * prixNum,
        nouveauCump: newCump,
        nouveauStock: stockActuel + qteNum,
      };
    }
    if (mode === "sortie") {
      const cumpAct = cumpActuel ?? 0;
      return {
        kind: "sortie" as const,
        valeur: qteNum * cumpAct,
        nouveauCump: cumpAct,
        nouveauStock: stockActuel - qteNum,
      };
    }
    return null;
  }, [mode, qteNum, prixNum, stockActuel, cumpActuel, selectedPanneau]);

  const overstock = mode === "sortie" && qteNum > stockActuel;

  async function submit() {
    if (!selectedPanneau) {
      toast.error("Sélectionnez un panneau");
      return;
    }
    if (!Number.isFinite(qteNum) || qteNum <= 0) {
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
        `Stock disponible : ${formatNumber(stockActuel, 2)}. Cochez « Forcer » pour valider.`,
      );
      return;
    }
    if (mode === "correction" && !commentaire.trim()) {
      toast.error("Commentaire obligatoire pour une correction");
      return;
    }

    setSubmitting(true);

    let typeMvt: Database["public"]["Enums"]["type_mouvement"] = "entree";
    let signedQte = qteNum;
    let prix: number | null = null;
    let comment = commentaire.trim() || null;

    if (mode === "entree") {
      typeMvt = "entree";
      signedQte = qteNum;
      prix = prixNum;
    } else if (mode === "sortie") {
      typeMvt = "sortie";
      signedQte = -qteNum;
    } else {
      typeMvt = "correction";
      signedQte = signe === "moins" ? -qteNum : qteNum;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
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
            {/* Panneau */}
            <div>
              <Label>Panneau *</Label>
              <Popover open={panneauOpen} onOpenChange={setPanneauOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedPanneau && "text-muted-foreground")}>
                      {selectedPanneau ? (
                        <>
                          <span className="font-mono text-xs">{selectedPanneau.matiere_code}</span>
                          {" — "}
                          {selectedPanneau.matiere_libelle}{" "}
                          <span className="text-muted-foreground">
                            ({selectedPanneau.longueur_mm}×{selectedPanneau.largeur_mm})
                          </span>
                        </>
                      ) : (
                        "Sélectionner…"
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher matière, dimensions…" />
                    <CommandList>
                      <CommandEmpty>Aucun panneau trouvé.</CommandEmpty>
                      <CommandGroup>
                        {filteredPanneauxForList.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.matiere_code} ${p.matiere_libelle} ${p.longueur_mm}x${p.largeur_mm}`}
                            onSelect={() => {
                              setPanneauId(p.id);
                              setPanneauOpen(false);
                              if (mode === "entree") setPrixUnitaire("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                panneauId === p.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="font-mono text-xs mr-2">{p.matiere_code}</span>
                            <span className="flex-1 truncate">{p.matiere_libelle}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {p.longueur_mm}×{p.largeur_mm} · stock{" "}
                              {formatNumber(Number(p.stock_actuel ?? 0), 2)}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quantité */}
            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "correction" && (
                <div>
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
                <Label>
                  Quantité *{" "}
                  {selectedPanneau && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({uniteLabel(selectedPanneau.unite_stock)})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  placeholder="0"
                />
              </div>
              {(mode === "entree" || (mode === "correction" && correctionCump)) && (
                <div>
                  <Label>Prix unitaire HT (€) {mode === "entree" && "*"}</Label>
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
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CUMP actuel</span>
                  <span className="font-medium">
                    {cumpActuel === null ? "—" : formatEuro(cumpActuel)}
                  </span>
                </div>
                {apercu && (
                  <>
                    <div className="border-t border-border my-2" />
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
                        {formatEuro(apercu.nouveauCump)}
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
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === "sortie" && overstock && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                <p className="font-medium text-warning">
                  Quantité supérieure au stock disponible ({formatNumber(stockActuel, 2)}).
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
