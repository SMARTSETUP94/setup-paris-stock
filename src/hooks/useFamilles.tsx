import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FAMILLES, type Famille } from "@/lib/familles";

export type FamilleMeta = {
  value: Famille;
  label: string;
  color: string;
  defaultLabel: string;
  defaultColor: string;
  isOverridden: boolean;
};

type Override = {
  famille: Famille;
  label: string | null;
  couleur: string | null;
};

type FamillesContextValue = {
  familles: FamilleMeta[];
  byValue: Record<Famille, FamilleMeta>;
  loading: boolean;
  refresh: () => Promise<void>;
};

const FamillesContext = createContext<FamillesContextValue | null>(null);

function buildList(overrides: Override[]): FamilleMeta[] {
  const map = new Map(overrides.map((o) => [o.famille, o]));
  return FAMILLES.map((f) => {
    const ov = map.get(f.value);
    const label = ov?.label?.trim() ? ov.label : f.label;
    const color = ov?.couleur?.trim() ? ov.couleur : f.color;
    return {
      value: f.value,
      label,
      color,
      defaultLabel: f.label,
      defaultColor: f.color,
      isOverridden: Boolean((ov?.label && ov.label.trim()) || (ov?.couleur && ov.couleur.trim())),
    };
  });
}

export function FamillesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("familles_overrides")
      .select("famille, label, couleur");
    if (error) {
      console.error("[useFamilles] load error:", error);
      setOverrides([]);
    } else {
      setOverrides((data ?? []) as Override[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("familles_overrides_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "familles_overrides" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo<FamillesContextValue>(() => {
    const familles = buildList(overrides);
    const byValue = familles.reduce(
      (acc, f) => {
        acc[f.value] = f;
        return acc;
      },
      {} as Record<Famille, FamilleMeta>,
    );
    return { familles, byValue, loading, refresh: load };
  }, [overrides, loading]);

  return <FamillesContext.Provider value={value}>{children}</FamillesContext.Provider>;
}

export function useFamilles() {
  const ctx = useContext(FamillesContext);
  if (ctx) return ctx;
  // Fallback hors provider (sécurité) : retourne les défauts
  const familles = buildList([]);
  const byValue = familles.reduce(
    (acc, f) => {
      acc[f.value] = f;
      return acc;
    },
    {} as Record<Famille, FamilleMeta>,
  );
  return {
    familles,
    byValue,
    loading: false,
    refresh: async () => {},
  } satisfies FamillesContextValue;
}

export function useFamilleMeta(value: Famille | string | null | undefined): FamilleMeta {
  const { byValue, familles } = useFamilles();
  if (value && (value as Famille) in byValue) {
    return byValue[value as Famille];
  }
  return familles[familles.length - 1];
}
