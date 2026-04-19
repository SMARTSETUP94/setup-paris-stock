import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Briefcase,
  FileText,
  ArrowLeftRight,
  Settings,
  LogOut,
  Truck,
  ClipboardCheck,
  QrCode,
  ChevronDown,
  Layers,
  Tags,
  Component,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BrandingLogo } from "@/components/BrandingLogo";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly: boolean;
};

// Items affichés en haut de sidebar selon le rôle
const adminMainItems: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: false },
];

const tiersMainItems: NavItem[] = [
  { to: "/mes-acces", label: "Mes accès", icon: KeyRound, adminOnly: false },
];

const catalogueChildren: NavItem[] = [
  { to: "/catalogue/typologies", label: "Typologies", icon: Layers, adminOnly: false },
  { to: "/catalogue/matieres", label: "Matières", icon: Package, adminOnly: false },
  { to: "/catalogue/panneaux", label: "Panneaux", icon: Component, adminOnly: false },
  { to: "/catalogue/etiquettes", label: "Étiquettes", icon: Tags, adminOnly: false },
];

const afterCatalogueItems: NavItem[] = [
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck, adminOnly: false },
  { to: "/affaires", label: "Affaires", icon: Briefcase, adminOnly: false },
  { to: "/bdc", label: "Bons de commande", icon: FileText, adminOnly: false },
  { to: "/mouvements", label: "Mouvements", icon: ArrowLeftRight, adminOnly: false },
  { to: "/parametres", label: "Paramètres", icon: Settings, adminOnly: true },
];

const atelierItems: NavItem[] = [
  { to: "/scan", label: "Scanner", icon: QrCode, adminOnly: false },
  { to: "/inventaire", label: "Inventaire", icon: ClipboardCheck, adminOnly: true },
];

const adminMobileItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/catalogue/matieres", label: "Catalogue", icon: Package },
  { to: "/affaires", label: "Affaires", icon: Briefcase },
  { to: "/scan", label: "Scan", icon: QrCode },
] as const;

const tiersMobileItems = [
  { to: "/mes-acces", label: "Mes accès", icon: KeyRound },
  { to: "/scan", label: "Scan", icon: QrCode },
] as const;

function SetupLogo({ size = "sm" as const }: { size?: "sm" | "md" }) {
  return <BrandingLogo size={size} showTagline />;
}

const CATALOGUE_KEY = "sidebar-catalogue-open";

function isPathActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname.startsWith(to);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
        active ? "font-semibold text-foreground" : "font-medium text-foreground/80 hover:bg-muted",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-2 -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function SidebarSubLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "relative flex items-center gap-2 rounded-md pl-9 pr-3 py-2 text-sm transition-colors",
        active ? "font-semibold text-foreground" : "font-medium text-foreground/70 hover:bg-muted",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      {item.label}
    </Link>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  const mainItems = isAdmin ? adminMainItems : tiersMainItems;
  const mobileItems = isAdmin ? adminMobileItems : tiersMobileItems;

  const catalogueIsActive = location.pathname.startsWith("/catalogue");
  const [catalogueOpen, setCatalogueOpen] = useState(catalogueIsActive);

  // Hydrate from localStorage on client only (avoid SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CATALOGUE_KEY);
      if (stored !== null) setCatalogueOpen(stored === "1");
    } catch {
      // ignore
    }
  }, []);

  // Auto-open if user navigates into catalogue
  useEffect(() => {
    if (catalogueIsActive) setCatalogueOpen(true);
  }, [catalogueIsActive]);

  function toggleCatalogue() {
    setCatalogueOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(CATALOGUE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="px-6 py-7 border-b border-border">
          <SetupLogo size="md" />
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {mainItems
            .filter((i) => !i.adminOnly || profile?.role === "admin")
            .map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                active={isPathActive(location.pathname, item.to)}
              />
            ))}

          {/* Catalogue accordion */}
          <div>
            <button
              type="button"
              onClick={toggleCatalogue}
              aria-expanded={catalogueOpen}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                catalogueIsActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/80 hover:bg-muted",
              )}
            >
              {catalogueIsActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-2 -translate-y-1/2 rounded-full bg-primary"
                />
              )}
              <Package className="h-4 w-4" />
              <span className="flex-1 text-left">Catalogue</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  catalogueOpen ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
            {catalogueOpen && (
              <div className="mt-0.5 space-y-0.5">
                {catalogueChildren.map((child) => (
                  <SidebarSubLink
                    key={child.to}
                    item={child}
                    active={
                      location.pathname === child.to || location.pathname.startsWith(child.to + "/")
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {afterCatalogueItems
            .filter((i) => !i.adminOnly || profile?.role === "admin")
            .map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                active={isPathActive(location.pathname, item.to)}
              />
            ))}

          {/* Atelier section */}
          <div className="pt-4 mt-2 border-t border-border">
            <p className="eyebrow px-3 pb-1.5">Atelier</p>
            {atelierItems
              .filter((i) => !i.adminOnly || profile?.role === "admin")
              .map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  active={isPathActive(location.pathname, item.to)}
                />
              ))}
          </div>
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate text-foreground">
              {profile?.nom_complet ?? profile?.email}
            </p>
            <p className="eyebrow mt-1">{profile?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card">
          <SetupLogo />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 px-4 py-8 md:px-10 md:py-12 pb-24 md:pb-12 overflow-x-hidden">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex">
          {mobileItems.map((item) => {
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
