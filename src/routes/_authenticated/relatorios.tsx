import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FileDown, Loader2, Calendar, Users, DollarSign } from "lucide-react";
import { jsPDF } from "jspdf";
import letterhead from "@/assets/papel-timbrado.jpg";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

type Role = "admin" | "psicologo" | "profissional" | "administrativo";
type ApptStatus = "pendente" | "confirmado" | "nao_confirmado" | "remarcado" | "cancelado" | "realizado";
type EntryType = "entrada" | "saida";

interface Appt { professional_id: string; patient_id: string; starts_at: string; status: ApptStatus }
interface Fin { professional_id: string; amount: number; status: "pendente" | "pago" | "cancelado"; entry_type: EntryType; category: string | null; entry_date: string }

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function monthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function monthEnd(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }

function RelatoriosPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  const [appts, setAppts] = useState<Appt[]>([]);
  const [fins, setFins] = useState<Fin[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [patMap, setPatMap] = useState<Record<string, string>>({});
  const [newPatients, setNewPatients] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).maybeSingle();
      setRole((roleRow?.role as Role | undefined) ?? "administrativo");

      const fromIso = from + "T00:00:00";
      const toIso = to + "T23:59:59";

      const [appsRes, finsRes, patsRes, profsRes, newPatsRes] = await Promise.all([
        supabase.from("appointments").select("professional_id, patient_id, starts_at, status").gte("starts_at", fromIso).lte("starts_at", toIso),
        supabase.from("financial_entries").select("professional_id, amount, status, entry_type, category, entry_date").gte("entry_date", from).lte("entry_date", to),
        supabase.from("patients").select("id, full_name"),
        supabase.rpc("get_professionals_for_agenda"),
        supabase.from("patients").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      ]);

      setAppts((appsRes.data as Appt[] | null) ?? []);
      setFins((finsRes.data as Fin[] | null) ?? []);
      const pm: Record<string, string> = {};
      (patsRes.data ?? []).forEach((p: any) => { pm[p.id] = p.full_name; });
      setPatMap(pm);
      const prm: Record<string, string> = {};
      ((profsRes.data ?? []) as any[]).forEach((p) => { prm[p.user_id] = p.full_name ?? "—"; });
      setProfMap(prm);
      setNewPatients(newPatsRes.count ?? 0);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const summary = useMemo(() => {
    const apptsByStatus: Record<ApptStatus, number> = {
      pendente: 0, confirmado: 0, nao_confirmado: 0, remarcado: 0, cancelado: 0, realizado: 0,
    };
    appts.forEach((a) => { apptsByStatus[a.status] = (apptsByStatus[a.status] ?? 0) + 1; });

    const realizados = apptsByStatus.realizado;
    const pacientesAtendidos = new Set(appts.filter((a) => a.status === "realizado").map((a) => a.patient_id)).size;

    let receita = 0, despesa = 0, recebido = 0, aReceber = 0;
    for (const f of fins) {
      const v = Number(f.amount) || 0;
      if (f.status === "cancelado") continue;
      if (f.entry_type === "entrada") {
        receita += v;
        if (f.status === "pago") recebido += v; else aReceber += v;
      } else despesa += v;
    }

    const profStats = new Map<string, { atend: number; receita: number }>();
    appts.forEach((a) => {
      if (a.status !== "realizado") return;
      const k = a.professional_id;
      const cur = profStats.get(k) ?? { atend: 0, receita: 0 };
      cur.atend += 1; profStats.set(k, cur);
    });
    fins.forEach((f) => {
      if (f.entry_type !== "entrada" || f.status === "cancelado") return;
      const cur = profStats.get(f.professional_id) ?? { atend: 0, receita: 0 };
      cur.receita += Number(f.amount) || 0;
      profStats.set(f.professional_id, cur);
    });
    const topProfs = Array.from(profStats.entries())
      .map(([id, v]) => ({ name: profMap[id] ?? "—", ...v }))
      .sort((a, b) => b.receita - a.receita).slice(0, 8);

    const patStats = new Map<string, number>();
    appts.forEach((a) => { if (a.status === "realizado") patStats.set(a.patient_id, (patStats.get(a.patient_id) ?? 0) + 1); });
    const topPats = Array.from(patStats.entries())
      .map(([id, n]) => ({ name: patMap[id] ?? "—", atend: n }))
      .sort((a, b) => b.atend - a.atend).slice(0, 8);

    const despesasPorCat = new Map<string, number>();
    fins.forEach((f) => {
      if (f.entry_type !== "saida" || f.status === "cancelado") return;
      const k = f.category || "Sem categoria";
      despesasPorCat.set(k, (despesasPorCat.get(k) ?? 0) + (Number(f.amount) || 0));
    });
    const topDespesas = Array.from(despesasPorCat.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount).slice(0, 8);

    return {
      apptsByStatus, realizados, pacientesAtendidos,
      receita, despesa, resultado: receita - despesa, recebido, aReceber,
      topProfs, topPats, topDespesas,
    };
  }, [appts, fins, profMap, patMap]);

  const loadLetterhead = (): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = letterhead;
    });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let img: HTMLImageElement | null = null;
      try { img = await loadLetterhead(); } catch { /* ignore */ }

      const drawHeader = (page: number) => {
        if (img) doc.addImage(img, "JPEG", 0, 0, pageW, pageH);
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(12, 35, 64);
        doc.text("Relatório Mensal Consolidado", pageW / 2, 100, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
        doc.text(`Período: ${new Date(from + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(to + "T00:00:00").toLocaleDateString("pt-BR")}`, pageW / 2, 118, { align: "center" });
        doc.text(`Página ${page}`, pageW - 60, pageH - 40);
      };

      let y = 150;
      let page = 1;
      drawHeader(page);

      const ensure = (need: number) => {
        if (y + need > pageH - 70) { doc.addPage(); page += 1; drawHeader(page); y = 150; }
      };
      const section = (title: string) => {
        ensure(40);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(12, 35, 64);
        doc.text(title, 60, y); y += 8;
        doc.setDrawColor(45, 138, 158); doc.setLineWidth(1); doc.line(60, y, pageW - 60, y); y += 18;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      };
      const line = (label: string, value: string) => {
        ensure(16);
        doc.setFont("helvetica", "normal"); doc.text(label, 70, y);
        doc.setFont("helvetica", "bold"); doc.text(value, pageW - 60, y, { align: "right" });
        y += 16;
      };

      section("Resumo de atendimentos");
      line("Pacientes novos no período", String(newPatients));
      line("Atendimentos agendados", String(appts.length));
      line("Realizados", String(summary.realizados));
      line("Confirmados (futuros)", String(summary.apptsByStatus.confirmado));
      line("Pendentes", String(summary.apptsByStatus.pendente));
      line("Não confirmados", String(summary.apptsByStatus.nao_confirmado));
      line("Remarcados", String(summary.apptsByStatus.remarcado));
      line("Cancelados", String(summary.apptsByStatus.cancelado));
      line("Pacientes únicos atendidos", String(summary.pacientesAtendidos));
      y += 8;

      section("Resumo financeiro");
      line("Receita (entradas não canceladas)", fmtBRL(summary.receita));
      line("Despesa (saídas não canceladas)", fmtBRL(summary.despesa));
      line("Resultado do período", fmtBRL(summary.resultado));
      line("Já recebido", fmtBRL(summary.recebido));
      line("A receber", fmtBRL(summary.aReceber));
      y += 8;

      section("Top profissionais (por receita)");
      if (summary.topProfs.length === 0) { line("—", "—"); }
      else summary.topProfs.forEach((p) => line(`${p.name}  ·  ${p.atend} atend.`, fmtBRL(p.receita)));
      y += 8;

      section("Top pacientes (por nº de atendimentos)");
      if (summary.topPats.length === 0) line("—", "—");
      else summary.topPats.forEach((p) => line(p.name, `${p.atend} atend.`));
      y += 8;

      section("Principais categorias de despesa");
      if (summary.topDespesas.length === 0) line("—", "—");
      else summary.topDespesas.forEach((d) => line(d.category, fmtBRL(d.amount)));

      ensure(40); y = Math.max(y, pageH - 100);
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 60, pageH - 40);

      doc.save(`relatorio_${from}_a_${to}.pdf`);
      toast.success("Relatório gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const isAdminOrAdmin = role === "admin" || role === "administrativo";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" /> Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Relatório mensal consolidado: atendimentos, financeiro, top profissionais e pacientes.
          </p>
        </div>
        <Button onClick={generatePDF} disabled={generating || loading}>
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : <><FileDown className="w-4 h-4 mr-2" /> Baixar PDF consolidado</>}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={() => { setFrom(monthStart()); setTo(monthEnd()); }}>Mês atual</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini icon={Users} label="Pacientes novos" value={String(newPatients)} />
            <Mini icon={Calendar} label="Atendimentos realizados" value={String(summary.realizados)} />
            <Mini icon={DollarSign} label="Receita" value={fmtBRL(summary.receita)} colorClass="text-green-600" />
            <Mini icon={DollarSign} label="Resultado" value={fmtBRL(summary.resultado)} colorClass={summary.resultado >= 0 ? "text-primary" : "text-red-600"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top profissionais (por receita)</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {summary.topProfs.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : summary.topProfs.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm border-b last:border-0 py-1">
                    <span>{p.name} <span className="text-muted-foreground text-xs">· {p.atend} atend.</span></span>
                    <span className="font-medium">{fmtBRL(p.receita)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top pacientes (por atendimentos)</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {summary.topPats.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : summary.topPats.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm border-b last:border-0 py-1">
                    <span>{p.name}</span>
                    <span className="font-medium">{p.atend} atend.</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {isAdminOrAdmin && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Principais categorias de despesa</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {summary.topDespesas.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas no período</p> : summary.topDespesas.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm border-b last:border-0 py-1">
                    <span>{d.category}</span>
                    <span className="font-medium text-red-600">{fmtBRL(d.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Mini({ icon: Icon, label, value, colorClass }: { icon: React.ElementType; label: string; value: string; colorClass?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</CardTitle></CardHeader>
      <CardContent><p className={`text-xl font-bold ${colorClass ?? ""}`}>{value}</p></CardContent>
    </Card>
  );
}
