import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { Loader2, Upload, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractNumeroFromFilename } from "@/lib/bdc";
import { useServerFn } from "@tanstack/react-start";
import { ocrBdc } from "@/lib/bdc-ocr.functions";

type Fournisseur = { id: string; nom: string };
type Affaire = { id: string; code_chantier: string; nom: string };

export function NewBdcDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const ocrFn = useServerFn(ocrBdc);
  const [file, setFile] = useState<File | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [affaireId, setAffaireId] = useState("");
  const [numeroBdc, setNumeroBdc] = useState("");
  const [dateBdc, setDateBdc] = useState(new Date().toISOString().slice(0, 10));
  const [fournisseurOpen, setFournisseurOpen] = useState(false);
  const [affaireOpen, setAffaireOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingFournisseur, setCreatingFournisseur] = useState(false);
  const [newFournisseurNom, setNewFournisseurNom] = useState("");

  useEffect(() => {
    void (async () => {
      const [f, a] = await Promise.all([
        supabase.from("fournisseurs").select("id, nom").order("nom"),
        supabase
          .from("affaires")
          .select("id, code_chantier, nom")
          .eq("statut", "en_cours")
          .order("code_chantier"),
      ]);
      setFournisseurs((f.data as Fournisseur[]) ?? []);
      setAffaires((a.data as Affaire[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function handleFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Seuls les PDF sont acceptés");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("PDF trop volumineux (max 20 Mo)");
      return;
    }
    setFile(f);
    if (!numeroBdc) {
      const n = extractNumeroFromFilename(f.name);
      if (n) setNumeroBdc(n);
    }
  }

  const selectedFournisseur = useMemo(
    () => fournisseurs.find((f) => f.id === fournisseurId) ?? null,
    [fournisseurs, fournisseurId],
  );
  const selectedAffaire = useMemo(
    () => affaires.find((a) => a.id === affaireId) ?? null,
    [affaires, affaireId],
  );

  async function createFournisseurInline() {
    const nom = newFournisseurNom.trim();
    if (!nom) return;
    const { data, error } = await supabase
      .from("fournisseurs")
      .insert({ nom })
      .select("id, nom")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    setFournisseurs((prev) => [...prev, data]);
    setFournisseurId(data.id);
    setCreatingFournisseur(false);
    setNewFournisseurNom("");
    toast.success("Fournisseur créé");
  }

  async function submit() {
    if (!file) {
      toast.error("Sélectionnez un PDF");
      return;
    }
    if (!fournisseurId) {
      toast.error("Sélectionnez un fournisseur");
      return;
    }
    setSubmitting(true);

    // 1. Upload PDF
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const path = `${yyyy}/${mm}/${uuid}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("bdc-uploads")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      setSubmitting(false);
      toast.error("Upload échoué : " + upErr.message);
      return;
    }

    // 2. Insert BDC
    const { data: bdc, error: insErr } = await supabase
      .from("bons_de_commande")
      .insert({
        fournisseur_id: fournisseurId,
        affaire_id: affaireId || null,
        numero_bdc: numeroBdc || null,
        date_bdc: dateBdc || null,
        fichier_pdf_url: path,
        statut: "en_attente_ocr",
      })
      .select("id")
      .single();
    if (insErr || !bdc) {
      setSubmitting(false);
      toast.error("Création BDC échouée : " + (insErr?.message ?? ""));
      return;
    }

    toast.success("PDF uploadé, OCR en cours…", {
      description: "Analyse du document, 10 à 30 secondes.",
      duration: 30_000,
    });

    // 3. Lancer l'OCR (server function)
    try {
      const result = await ocrFn({ data: { bdcId: bdc.id } });
      if (result.ok) {
        toast.success(
          `OCR terminé : ${result.lignes_extraites} ligne(s), ${result.lignes_matchees} matchée(s)`,
        );
      } else {
        toast.warning(
          `OCR échoué : ${result.error}. Vous pouvez le relancer depuis la page de validation.`,
        );
      }
    } catch (e) {
      toast.error("Erreur OCR : " + (e instanceof Error ? e.message : "inconnue"));
    }

    setSubmitting(false);
    onCreated();
    navigate({ to: "/bdc/$id", params: { id: bdc.id } });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouveau bon de commande</DialogTitle>
          <DialogDescription>
            Déposez le PDF — l'OCR Mindee extrait fournisseur, lignes et montants.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drop zone */}
            <label
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 cursor-pointer hover:bg-muted/50 transition-colors",
                file && "border-primary/40 bg-primary/5",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} Mo · cliquez pour changer
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">Glissez-déposez le PDF</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    ou cliquez pour sélectionner (max 20 Mo)
                  </span>
                </>
              )}
            </label>

            {/* Fournisseur */}
            <div>
              <Label>Fournisseur *</Label>
              {creatingFournisseur ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom du fournisseur"
                    value={newFournisseurNom}
                    onChange={(e) => setNewFournisseurNom(e.target.value)}
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={createFournisseurInline}>
                    Créer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreatingFournisseur(false);
                      setNewFournisseurNom("");
                    }}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <Popover open={fournisseurOpen} onOpenChange={setFournisseurOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      <span
                        className={cn("truncate", !selectedFournisseur && "text-muted-foreground")}
                      >
                        {selectedFournisseur?.nom ?? "Sélectionner un fournisseur…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher…" />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline"
                            onClick={() => {
                              setFournisseurOpen(false);
                              setCreatingFournisseur(true);
                            }}
                          >
                            + Créer un fournisseur
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {fournisseurs.map((f) => (
                            <CommandItem
                              key={f.id}
                              value={f.nom}
                              onSelect={() => {
                                setFournisseurId(f.id);
                                setFournisseurOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  fournisseurId === f.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {f.nom}
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="__create__"
                            onSelect={() => {
                              setFournisseurOpen(false);
                              setCreatingFournisseur(true);
                            }}
                          >
                            <span className="text-primary">+ Créer un fournisseur</span>
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>N° BDC</Label>
                <Input
                  value={numeroBdc}
                  onChange={(e) => setNumeroBdc(e.target.value)}
                  placeholder="auto-extrait du nom de fichier"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={dateBdc} onChange={(e) => setDateBdc(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Affaire (optionnel)</Label>
              <Popover open={affaireOpen} onOpenChange={setAffaireOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedAffaire && "text-muted-foreground")}>
                      {selectedAffaire ? (
                        <>
                          <span className="font-mono text-xs mr-2">
                            {selectedAffaire.code_chantier}
                          </span>
                          {selectedAffaire.nom}
                        </>
                      ) : (
                        "— Aucune (stock général)"
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Code chantier ou nom…" />
                    <CommandList>
                      <CommandEmpty>Aucune affaire active.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            setAffaireId("");
                            setAffaireOpen(false);
                          }}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", !affaireId ? "opacity-100" : "opacity-0")}
                          />
                          <span className="text-muted-foreground">— Aucune</span>
                        </CommandItem>
                        {affaires.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.code_chantier} ${a.nom}`}
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
                            <span className="font-mono text-xs mr-2">{a.code_chantier}</span>
                            <span className="truncate">{a.nom}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !file || !fournisseurId}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Uploader et lancer l'OCR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
