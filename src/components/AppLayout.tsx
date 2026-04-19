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
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="px-6 py-5 border-b">
          <h1 className="text-lg font-bold text-primary">Setup Stock</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Setup Paris</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">
              {profile?.nom_complet ?? profile?.email}
            </p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
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
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-card">
          <h1 className="text-base font-bold text-primary">Setup Stock</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 overflow-x-hidden">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t flex">
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
                    "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs",
                    active ? "text-primary" : "text-muted-foreground"
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
