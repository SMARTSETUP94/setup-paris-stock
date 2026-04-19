import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Briefcase,
  FileText,
  ArrowLeftRight,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, mobile: true },
  { to: "/catalogue", label: "Catalogue", icon: Package, mobile: true },
  { to: "/affaires", label: "Affaires", icon: Briefcase, mobile: true },
  { to: "/bdc", label: "Bons de commande", icon: FileText, mobile: true },
  { to: "/mouvements", label: "Mouvements", icon: ArrowLeftRight, mobile: false },
  { to: "/parametres", label: "Paramètres", icon: Settings, mobile: false },
] as const;

function SetupLogo() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-base font-semibold tracking-tight text-[color:var(--color-heading)]">
        SET UP
      </span>
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#FFB700] text-[10px] font-bold text-black"
      >
        ⚡
      </span>
    </div>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="px-6 py-6 border-b border-border">
          <SetupLogo />
          <p className="eyebrow mt-3">Stock · Setup Paris</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground/80 hover:bg-muted",
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
          })}
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
          {navItems
            .filter((i) => i.mobile)
            .map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
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
