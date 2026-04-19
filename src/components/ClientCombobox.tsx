import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface Props {
  value: string | null;
  onChange: (clientId: string) => void;
  disabled?: boolean;
}

export function ClientCombobox({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [presetNom, setPresetNom] = useState("");

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("nom");
    setClients((data as Client[]) ?? []);
  }

  useEffect(() => {
    void loadClients();
  }, []);

  const selected = useMemo(() => clients.find((c) => c.id === value) ?? null, [clients, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.nom.toLowerCase().includes(q));
  }, [clients, query]);

  const exactMatch = useMemo(
    () => clients.some((c) => c.nom.toLowerCase() === query.trim().toLowerCase()),
    [clients, query],
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? (
                <>
                  {selected.nom}
                  {!selected.actif && (
                    <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: "#6B7280", backgroundColor: "rgba(107,114,128,0.10)" }}>
                      Inactif
                    </span>
                  )}
                </>
              ) : (
                "Sélectionner un client…"
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Rechercher un client…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                <div className="py-3 text-sm text-muted-foreground">Aucun client trouvé.</div>
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{c.nom}</span>
                    {!c.actif && (
                      <span className="ml-2 text-[10px] text-muted-foreground">Inactif</span>
                    )}
                  </CommandItem>
                ))}
                {query.trim() && !exactMatch && (
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setPresetNom(query.trim());
                      setCreateOpen(true);
                      setOpen(false);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Créer le client « {query.trim()} »
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ClientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        presetNom={presetNom}
        variant="mini"
        onSaved={(c) => {
          setClients((prev) => [...prev, c].sort((a, b) => a.nom.localeCompare(b.nom)));
          onChange(c.id);
          setQuery("");
        }}
      />
    </>
  );
}
