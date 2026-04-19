import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * S'abonne aux INSERT sur public.mouvements_stock et appelle `onChange`
 * (debouncé) à chaque nouveau mouvement. Permet de rafraîchir les compteurs
 * de stock en direct sans recharger la page.
 *
 * - `enabled` : n'active le canal que quand vrai (ex: après auth).
 * - `debounceMs` : regroupe les rafales (imports, validations BDC).
 */
export function useStockRealtime(
  onChange: () => void,
  enabled: boolean,
  debounceMs = 400,
) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), debounceMs);
    };

    const channel = supabase
      .channel("stock-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mouvements_stock" },
        trigger,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs]);
}
