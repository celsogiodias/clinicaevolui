import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, Activity, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PublicBookingCard } from "@/components/PublicBookingCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Status = "pendente" | "pago" | "cancelado";
type Method = "dinheiro" | "pix" | "cartao" | "transferencia" | "convenio" | "outro";

interface FinEntry {
  amount: number;
  status: Status;
  method: Method | null;
  professional_id: string;
  entry_date: string;
}

const statusColors: Record<Status, string> = { pago: "#16a34a", pendente: "#f59e0b", cancelado: "#a1a1aa" };
const methodLabels: Record<Method, string> = { dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", transferencia: "Transf.", convenio: "Convênio", outro: "Outro" };
const palette = ["#0c2340", "#1a4a6e", "#2d8a9e", "#5cbdb9", "#16a34a", "#f59e0b", "#a855f7", "#ef4444"];

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthStartISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const monthEndISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, recent: 0 });
  const [profileName, setProfileName] = useState<string>("");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(monthEndISO());
  const [entries, setEntries] = useState<FinEntry[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        setProfileName(profile?.full_name?.split(" ")[0] ?? "");
      }
      const { count: total } = await supabase.from("patients").select("*", { count: "exact", head: true });
      const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const { count: recent } = await supabase.from("patients").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
      setStats({ total: total ?? 0, recent: recent ?? 0 });

      const { data: profs } = await supabase.rpc("get_professionals_for_agenda");
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name ?? "—"; });
      setProfMap(map);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("financial_entries")
        .select("amount, status, method, professional_id, entry_date")
        .gte("entry_date", from).lte("entry_date", to);
      setEntries((data as FinEntry[] | null) ?? []);
    })();
  }, [from, to]);

  const totals = useMemo(() => {
    const t = { total: 0, pago: 0, pendente: 0, cancelado: 0 };
    for (const e of entries) {
      const v = Number(e.amount) || 0;
      if (e.status !== "cancelado") t.total += v;
      t[e.status] += v;
    }
    return t;
  }, [entries]);

  const statusData = useMemo(
    () => (["pago", "pendente", "cancelado"] as Status[]).map((s) => ({
      name: s.charAt(0).toUpperCase() + s.slice(1), value: totals[s], color: statusColors[s],
    })).filter((d) => d.value > 0),
    [totals],
  );

  const methodData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) {
      if (e.status === "cancelado") continue;
      const key = e.method ? methodLabels[e.method] : "—";
      m[key] = (m[key] ?? 0) + (Number(e.amount) || 0);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [entries]);

  const profData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) {
      if (e.status === "cancelado") continue;
      const key = profMap[e.professional_id] ?? "—";
      m[key] = (m[key] ?? 0) + (Number(e.amount) || 0);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [entries, profMap]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá{profileName ? `, ${profileName}` : ""} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao seu painel. Aqui você acompanha pacientes, agenda e financeiro da clínica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total de pacientes" value={stats.total} accent />
        <StatCard icon={UserPlus} label="Novos (últimos 7 dias)" value={stats.recent} />
        <StatCard icon={Activity} label="Status" value="Ativo" isText />
      </div>

      <PublicBookingCard />

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" /> Financeiro no período</h2>
          <div className="flex items-end gap-2">
            <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniCard label="Total" value={fmtBRL(totals.total)} />
          <MiniCard label="Recebido" value={fmtBRL(totals.pago)} colorClass="text-green-600" />
          <MiniCard label="A receber" value={fmtBRL(totals.pendente)} colorClass="text-amber-600" />
          <MiniCard label="Cancelado" value={fmtBRL(totals.cancelado)} colorClass="text-zinc-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por status</CardTitle></CardHeader>
            <CardContent className="h-[240px]">
              {statusData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por método de pagamento</CardTitle></CardHeader>
            <CardContent className="h-[240px]">
              {methodData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Bar dataKey="value" fill="#2d8a9e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por profissional</CardTitle></CardHeader>
            <CardContent className="h-[240px]">
              {profData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Bar dataKey="value" fill="#1a4a6e" radius={[0, 4, 4, 0]}>
                      {profData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/patients">
          <div className="group bg-card border rounded-xl p-6 hover:border-accent transition-all hover:shadow-md cursor-pointer h-full">
            <Users className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg">Pacientes</h3>
            <p className="text-sm text-muted-foreground mt-1">Visualize, cadastre e edite seus pacientes.</p>
            <Button variant="link" className="px-0 mt-2 text-accent">Acessar →</Button>
          </div>
        </Link>
        <Link to="/agenda">
          <div className="group bg-card border rounded-xl p-6 hover:border-accent transition-all hover:shadow-md cursor-pointer h-full">
            <Calendar className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg">Agenda</h3>
            <p className="text-sm text-muted-foreground mt-1">Agende e acompanhe os atendimentos.</p>
            <Button variant="link" className="px-0 mt-2 text-accent">Acessar →</Button>
          </div>
        </Link>
      </div>
    </div>
  );
}

function Empty() { return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>; }

function MiniCard({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
      <CardContent><p className={`text-xl font-bold ${colorClass ?? ""}`}>{value}</p></CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon, label, value, accent, isText,
}: { icon: React.ElementType; label: string; value: string | number; accent?: boolean; isText?: boolean }) {
  return (
    <div className="bg-card border rounded-xl p-6" style={accent ? { boxShadow: "var(--shadow-md)" } : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`w-5 h-5 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-3 font-bold ${isText ? "text-lg text-accent" : "text-3xl"}`}>{value}</p>
    </div>
  );
}
