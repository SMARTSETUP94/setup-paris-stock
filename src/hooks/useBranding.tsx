import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  nom_application: string;
  nom_organisation: string;
  logo_url: string | null;
  couleur_accent: string;
  pied_page_pdf: string | null;
};

const DEFAULT_BRANDING: Branding = {
  nom_application: "Setup Stock",
  nom_organisation: "Setup Paris",
  logo_url: null,
  couleur_accent: "#FFB700",
  pied_page_pdf: null,
};

type BrandingContextValue = {
  branding: Branding;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("nom_application, nom_organisation, logo_url, couleur_accent, pied_page_pdf")
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      setBranding({
        nom_application: data.nom_application ?? DEFAULT_BRANDING.nom_application,
        nom_organisation: data.nom_organisation ?? DEFAULT_BRANDING.nom_organisation,
        logo_url: data.logo_url,
        couleur_accent: data.couleur_accent ?? DEFAULT_BRANDING.couleur_accent,
        pied_page_pdf: data.pied_page_pdf,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // Realtime — le branding change rarement mais on synchronise quand un admin l'édite
    const channel = supabase
      .channel("app_settings_changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Fallback hors provider (ex: pages publiques avant montage)
    return { branding: DEFAULT_BRANDING, loading: false, refresh: async () => {} };
  }
  return ctx;
}
