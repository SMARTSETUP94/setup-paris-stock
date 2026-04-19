import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fournisseur, Affaire, PanneauOption } from "./types";

export function FournisseurPicker({
  fournisseurs,
  value,
  disabled,
  onChange,
}: {
  fournisseurs: Fournisseur[];
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = fournisseurs.find((f) => f.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={cn("truncate", !sel && "text-muted-foreground")}>{sel?.nom ?? "—"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher…" />
          <CommandList>
            <CommandEmpty>Aucun</CommandEmpty>
            <CommandGroup>
              {fournisseurs.map((f) => (
                <CommandItem
                  key={f.id}
                  value={f.nom}
                  onSelect={() => { onChange(f.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === f.id ? "opacity-100" : "opacity-0")} />
                  {f.nom}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AffairePicker({
  affaires,
  value,
  disabled,
  onChange,
}: {
  affaires: Affaire[];
  value: string | null;
  disabled?: boolean;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = affaires.find((a) => a.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={cn("truncate", !sel && "text-muted-foreground")}>
            {sel ? (
              <>
                <span className="font-mono text-xs mr-2">{sel.code_chantier}</span>
                {sel.nom}
              </>
            ) : "— Aucune"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Code chantier ou nom…" />
          <CommandList>
            <CommandEmpty>Aucune</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">— Aucune</span>
              </CommandItem>
              {affaires.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.code_chantier} ${a.nom}`}
                  onSelect={() => { onChange(a.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs mr-2">{a.code_chantier}</span>
                  <span className="truncate">{a.nom}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PanneauPicker({
  panneaux,
  value,
  disabled,
  onChange,
}: {
  panneaux: PanneauOption[];
  value: string | null;
  disabled?: boolean;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = panneaux.find((p) => p.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 justify-between font-normal text-xs"
          disabled={disabled}
        >
          <span className={cn("truncate", !sel && "text-muted-foreground")}>
            {sel ? (
              <>
                <span className="font-mono mr-1">{sel.matiere_code}</span>
                <span>{sel.matiere_libelle}</span>
                <span className="text-muted-foreground ml-1">({sel.longueur_mm}×{sel.largeur_mm})</span>
              </>
            ) : "— À sélectionner"}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher matière, dimensions…" />
          <CommandList>
            <CommandEmpty>Aucun panneau</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">— Aucun</span>
              </CommandItem>
              {panneaux.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.matiere_code} ${p.matiere_libelle} ${p.longueur_mm}x${p.largeur_mm}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs mr-2">{p.matiere_code}</span>
                  <span className="flex-1 truncate">{p.matiere_libelle}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.longueur_mm}×{p.largeur_mm}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
