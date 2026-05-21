import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, UserPlus, Activity, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, recent: 0 });
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        setProfileName(profile?.full_name?.split(" ")[0] ?? "");
      }

      const { count: total } = await supabase
        .from("patients").select("*", { count: "exact", head: true });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recent } = await supabase
        .from("patients").select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo);

      setStats({ total: total ?? 0, recent: recent ?? 0 });
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá{profileName ? `, ${profileName}` : ""} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao seu painel. Aqui você acompanha seus pacientes e atividades da clínica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total de pacientes" value={stats.total} accent />
        <StatCard icon={UserPlus} label="Novos (últimos 7 dias)" value={stats.recent} />
        <StatCard icon={Activity} label="Status" value="Ativo" isText />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/patients">
          <div className="group bg-card border rounded-xl p-6 hover:border-accent transition-all hover:shadow-md cursor-pointer h-full">
            <Users className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg">Pacientes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Visualize, cadastre e edite seus pacientes.
            </p>
            <Button variant="link" className="px-0 mt-2 text-accent">
              Acessar →
            </Button>
          </div>
        </Link>
        <div className="bg-muted/50 border border-dashed rounded-xl p-6 h-full">
          <Calendar className="w-8 h-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg text-muted-foreground">Agenda</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Em breve — disponível na próxima fase de desenvolvimento.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent, isText,
}: { icon: React.ElementType; label: string; value: string | number; accent?: boolean; isText?: boolean }) {
  return (
    <div
      className="bg-card border rounded-xl p-6"
      style={accent ? { boxShadow: "var(--shadow-md)" } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`w-5 h-5 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-3 font-bold ${isText ? "text-lg text-accent" : "text-3xl"}`}>{value}</p>
    </div>
  );
}
