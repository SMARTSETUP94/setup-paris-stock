import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Trash2, Palette } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { BrandingLogo } from "@/components/BrandingLogo";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_SIZE_MB = 2;

export function BrandingTab() {
  const { branding, refresh } = useBranding();
  const [nomApp, setNomApp] = useState(branding.nom_application);
  const [nomOrg, setNomOrg] = useState(branding.nom_organisation);
  const [accent, setAccent] = useState(branding.couleur_accent);
  const [piedPdf, setPiedPdf] = useState(branding.pied_page_pdf ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNomApp(branding.nom_application);
    setNomOrg(branding.nom_organisation);
    setAccent(branding.couleur_accent);
    setPiedPdf(branding.pied_page_pdf ?? "");
  }, [branding]);

  async function getRowId() {
    const { data } = await supabase.from("app_settings").select("id").limit(1).maybeSingle();
    return data?.id ?? null;
  }

  async function handleSaveText() {
    setSaving(true);
    try {
      const id = await getRowId();
      if (!id) throw new Error("Configuration introuvable");
      const { error } = await supabase
        .from("app_settings")
        .update({
          nom_application: nomApp.trim() || "Setup Stock",
          nom_organisation: nomOrg.trim() || "Setup Paris",
          couleur_accent: accent.trim() || "#FFB700",
          pied_page_pdf: piedPdf.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Branding mis à jour");
      await refresh();
    } catch (e) {
      toast.error("Échec de la sauvegarde", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Format invalide", { description: "PNG, JPG, SVG ou WebP uniquement." });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error("Fichier trop lourd", { description: `${MAX_SIZE_MB} Mo maximum.` });
      return;
    }
    setUploading(true);
    try {
      // On utilise toujours le même chemin "logo.<ext>" pour remplacer
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      // Cache-bust pour forcer le rechargement immédiat
      const url = `${pub.publicUrl}?v=${Date.now()}`;

      const id = await getRowId();
      if (!id) throw new Error("Configuration introuvable");
      const { error: updErr } = await supabase
        .from("app_settings")
        .update({ logo_url: url })
        .eq("id", id);
      if (updErr) throw updErr;

      toast.success("Logo mis à jour");
      await refresh();
    } catch (e) {
      toast.error("Échec de l'upload", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    if (!branding.logo_url) return;
    if (!window.confirm("Supprimer le logo actuel ? Le placeholder texte réapparaîtra.")) return;
    try {
      const id = await getRowId();
      if (!id) throw new Error("Configuration introuvable");
      const { error } = await supabase
        .from("app_settings")
        .update({ logo_url: null })
        .eq("id", id);
      if (error) throw error;
      toast.success("Logo supprimé");
      await refresh();
    } catch (e) {
      toast.error("Suppression impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Aperçu */}
      <Card className="p-6">
        <p className="eyebrow mb-3">Aperçu</p>
        <div className="flex items-center gap-6 p-6 rounded-lg bg-muted/30 border border-border">
          <BrandingLogo size="lg" />
          <div className="text-sm text-muted-foreground">
            ↑ Tel qu'affiché en sidebar, page de connexion et page Scan.
          </div>
        </div>
      </Card>

      {/* Logo */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Logo</h3>
            <p className="text-sm text-muted-foreground">
              PNG, JPG, SVG ou WebP — 2 Mo maximum. Idéalement sur fond transparent.
            </p>
          </div>
          {branding.logo_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveLogo}
              disabled={uploading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
        </div>

        {branding.logo_url && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <img
              src={branding.logo_url}
              alt="Logo actuel"
              className="h-14 w-auto object-contain"
            />
            <div className="text-xs text-muted-foreground break-all">{branding.logo_url}</div>
          </div>
        )}

        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {branding.logo_url ? "Remplacer le logo" : "Téléverser un logo"}
          </Button>
        </div>
      </Card>

      {/* Identité textuelle */}
      <Card className="p-6 space-y-4">
        <h3 className="font-medium">Identité</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nom-app">Nom de l'application</Label>
            <Input
              id="nom-app"
              value={nomApp}
              onChange={(e) => setNomApp(e.target.value)}
              placeholder="Setup Stock"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nom-org">Nom de l'organisation</Label>
            <Input
              id="nom-org"
              value={nomOrg}
              onChange={(e) => setNomOrg(e.target.value)}
              placeholder="Setup Paris"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="accent" className="flex items-center gap-2">
              <Palette className="h-4 w-4" /> Couleur d'accent
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-10 w-16 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                placeholder="#FFB700"
                className="font-mono"
                maxLength={9}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisée pour le carré du logo placeholder. Format hex (#RRGGBB).
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pied-pdf">Pied de page PDF (BDC)</Label>
            <Textarea
              id="pied-pdf"
              value={piedPdf}
              onChange={(e) => setPiedPdf(e.target.value)}
              placeholder="Setup Paris — 12 rue Exemple, 75000 Paris — SIRET 000 000 000 00000"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Apparaîtra en bas des bons de commande générés en PDF (à venir).
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveText} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </Card>
    </div>
  );
}
