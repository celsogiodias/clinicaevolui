import { createFileRoute, redirect, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, LayoutDashboard, LogOut, Menu, X, ShieldCheck, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AuthenticatedLayout,
});

type Profile = { full_name: string | null; email: string | null };
type Role = "admin" | "psicologo" | "profissional" | "administrativo";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  psicologo: "Psicólogo(a)",
  profissional: "Profissional",
  administrativo: "Administrativo",
};

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).order("role").limit(1).maybeSingle(),
      ]);
      setProfile(profileData ?? { full_name: user.email ?? null, email: user.email ?? null });
      setRole((roleData?.role as Role | undefined) ?? "administrativo");
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta");
    navigate({ to: "/login" });
  };

  const navItems = [
    { to: "/dashboard", label: "Início", icon: LayoutDashboard, adminOnly: false },
    { to: "/agenda", label: "Agenda", icon: Calendar, adminOnly: false },
    { to: "/patients", label: "Pacientes", icon: Users, adminOnly: false },
    { to: "/users", label: "Usuários", icon: ShieldCheck, adminOnly: true },
  ].filter((i) => !i.adminOnly || role === "admin");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground z-40 transform transition-transform lg:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-sidebar-border bg-white">
          <img src={logo} alt="AtivaMente — visão integrativa" className="w-full h-auto max-h-28 object-contain" />
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
            {role && (
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary font-medium uppercase tracking-wide">
                {roleLabels[role]}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <img src={logo} alt="AtivaMente" className="h-8 w-auto" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
