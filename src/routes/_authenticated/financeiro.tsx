import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Trash2, Pencil, DollarSign, CheckCircle2, Clock, XCircle, FileSpreadsheet, FileDown, Receipt, TrendingUp, TrendingDown, QrCode } from "lucide-react";
import { exportEntriesToCSV, exportEntriesToPDF, generateReceiptPDF, type ExportEntry } from "@/lib/financialExport";
import { ParetoChart } from "@/components/financeiro/ParetoChart";
import { FinancialAdvisor } from "@/components/financeiro/FinancialAdvisor";
import { PixDialog } from "@/components/financeiro/PixDialog";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

type Status = "pendente" | "pago" | "cancelado";
type Method = "dinheiro" | "pix" | "cartao" | "transferencia" | "convenio" | "outro";
type EntryType = "entrada" | "saida";
type Role = "admin" | "psicologo" | "profissional" | "administrativo";

interface Entry {
  id: string;
  patient_id: string;
  professional_id: string;
  description: string;
  amount: number;
  entry_date: string;
  status: Status;
  method: Method | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string;
  entry_type: EntryType;
  category: string | null;
}

interface PatientRow { id: string; full_name: string }
interface ProfRow { user_id: string; full_name: string | null }

const statusMeta: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pendente:  { label: "Pendente",  cls: "bg-amber-100 text-amber-800 border-amber-300",  Icon: Clock },
  pago:      { label: "Pago",      cls: "bg-green-100 text-green-800 border-green-300",  Icon: CheckCircle2 },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-600 border-zinc-300 line-through", Icon: XCircle },
};

const methodLabels: Record<Method, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", transferencia: "Transferência", convenio: "Convênio", outro: "Outro",
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function monthEndISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }

function FinanceiroPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pixEntry, setPixEntry] = useState<Entry | null>(null);

  // filters
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(monthEndISO());
  const [filterProf, setFilterProf] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterType, setFilterType] = useState<EntryType | "all">("all");

  const canSeeAll = role === "admin" || role === "administrativo";

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).limit(1).maybeSingle();
    const r = (roleRow?.role as Role | undefined) ?? "administrativo";
    setRole(r);

    const [{ data: ents, error }, { data: pats }, { data: profs }] = await Promise.all([
      supabase.from("financial_entries").select("*").gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }),
      supabase.from("patients").select("id, full_name").order("full_name"),
      supabase.rpc("get_professionals_for_agenda"),
    ]);
    if (error) toast.error("Erro ao carregar lançamentos: " + error.message);
    setEntries((ents as Entry[] | null) ?? []);
    setPatients((pats as PatientRow[] | null) ?? []);
    setProfessionals(((profs as ProfRow[] | null) ?? []).map((p) => ({ user_id: p.user_id, full_name: p.full_name })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterProf !== "all" && e.professional_id !== filterProf) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterType !== "all" && e.entry_type !== filterType) return false;
      return true;
    });
  }, [entries, filterProf, filterStatus, filterType]);

  const totals = useMemo(() => {
    const t = { total: 0, pago: 0, pendente: 0, cancelado: 0, receita: 0, despesa: 0, resultado: 0 };
    for (const e of filtered) {
      const v = Number(e.amount) || 0;
      if (e.status !== "cancelado") {
        t.total += v;
        if (e.entry_type === "entrada") t.receita += v;
        else t.despesa += v;
      }
      t[e.status] += v;
    }
    t.resultado = t.receita - t.despesa;
    return t;
  }, [filtered]);

  const paretoData = useMemo(() => {
    const sumBy = (type: EntryType) => {
      const m = new Map<string, number>();
      for (const e of filtered) {
        if (e.entry_type !== type || e.status === "cancelado") continue;
        const k = (e.category && e.category.trim()) || "Sem categoria";
        m.set(k, (m.get(k) ?? 0) + Number(e.amount || 0));
      }
      return Array.from(m.entries()).map(([category, amount]) => ({ category, amount }));
    };
    return { receitas: sumBy("entrada"), despesas: sumBy("saida") };
  }, [filtered]);

  const advisorSummary = useMemo(() => {
    const paidEntries = filtered.filter((e) => e.entry_type === "entrada" && e.status === "pago");
    const ticketMedio = paidEntries.length ? paidEntries.reduce((s, e) => s + Number(e.amount || 0), 0) / paidEntries.length : 0;
    const entradas = filtered.filter((e) => e.entry_type === "entrada" && e.status !== "cancelado");
    const inadimplencia = entradas.length
      ? entradas.filter((e) => e.status === "pendente").reduce((s, e) => s + Number(e.amount || 0), 0) /
        entradas.reduce((s, e) => s + Number(e.amount || 0), 0) * 100
      : 0;
    const monthMap = new Map<string, { receita: number; despesa: number }>();
    for (const e of filtered) {
      if (e.status === "cancelado") continue;
      const m = e.entry_date.slice(0, 7);
      const cur = monthMap.get(m) ?? { receita: 0, despesa: 0 };
      if (e.entry_type === "entrada") cur.receita += Number(e.amount || 0);
      else cur.despesa += Number(e.amount || 0);
      monthMap.set(m, cur);
    }
    return {
      periodFrom: from,
      periodTo: to,
      totalReceita: totals.receita,
      totalDespesa: totals.despesa,
      resultado: totals.resultado,
      ticketMedio,
      inadimplencia: Math.round(inadimplencia * 10) / 10,
      receitaPorCategoria: paretoData.receitas,
      despesaPorCategoria: paretoData.despesas,
      evolucaoMensal: Array.from(monthMap.entries()).sort().map(([month, v]) => ({ month, ...v })),
    };
  }, [filtered, totals, paretoData, from, to]);

  const patientName = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "—";
  const profName = (id: string) => professionals.find((p) => p.user_id === id)?.full_name ?? "—";

  const openNew = () => {
    setEditing({
      id: "",
      patient_id: patients[0]?.id ?? "",
      professional_id: canSeeAll ? (professionals[0]?.user_id ?? "") : (currentUserId ?? ""),
      description: "",
      amount: 0,
      entry_date: todayISO(),
      status: "pendente",
      method: null,
      paid_at: null,
      notes: null,
      created_by: currentUserId ?? "",
      entry_type: "entrada",
      category: null,
    });
    setDialogOpen(true);
  };

  const openEdit = (e: Entry) => { setEditing({ ...e }); setDialogOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.patient_id || !editing.professional_id || !editing.description.trim()) {
      toast.error("Preencha paciente, profissional e descrição"); return;
    }
    if (editing.amount < 0) { toast.error("Valor inválido"); return; }

    const payload = {
      patient_id: editing.patient_id,
      professional_id: editing.professional_id,
      description: editing.description.trim(),
      amount: editing.amount,
      entry_date: editing.entry_date,
      status: editing.status,
      method: editing.method,
      notes: editing.notes?.trim() || null,
      entry_type: editing.entry_type,
      category: editing.category?.trim() || null,
    };

    if (editing.id) {
      const { error } = await supabase.from("financial_entries").update(payload).eq("id", editing.id);
      if (error) return toast.error(safeError(error, "Erro ao carregar financeiro."));
      toast.success("Lançamento atualizado");
    } else {
      const { error } = await supabase.from("financial_entries").insert({ ...payload, created_by: currentUserId! });
      if (error) return toast.error(safeError(error, "Erro ao carregar financeiro."));
      toast.success("Lançamento criado");
    }
    setDialogOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("financial_entries").delete().eq("id", id);
    if (error) return toast.error(safeError(error, "Erro ao carregar financeiro."));
    toast.success("Lançamento excluído"); load();
  };

  const buildExportEntries = (): ExportEntry[] =>
    filtered.map((e) => ({
      entry_date: e.entry_date,
      patient_name: patientName(e.patient_id),
      professional_name: profName(e.professional_id),
      description: e.description,
      amount: Number(e.amount),
      method: e.method,
      status: e.status,
      paid_at: e.paid_at,
    }));

  const onExportCSV = () => {
    if (filtered.length === 0) return toast.info("Nenhum lançamento para exportar");
    exportEntriesToCSV(buildExportEntries(), `financeiro_${from}_a_${to}.csv`);
  };
  const onExportPDF = async () => {
    if (filtered.length === 0) return toast.info("Nenhum lançamento para exportar");
    try {
      await exportEntriesToPDF(buildExportEntries(), { periodFrom: from, periodTo: to, totals }, `financeiro_${from}_a_${to}.pdf`);
    } catch (e: any) { toast.error("Erro ao gerar PDF: " + e.message); }
  };

  const issueReceipt = async (e: Entry) => {
    try {
      await generateReceiptPDF({
        patientName: patientName(e.patient_id),
        professionalName: profName(e.professional_id),
        description: e.description,
        amount: Number(e.amount),
        method: e.method,
        paidAt: e.paid_at ? new Date(e.paid_at) : new Date(),
        entryDate: e.entry_date,
        receiptNumber: e.id.slice(0, 8).toUpperCase(),
      });
    } catch (err: any) { toast.error("Erro ao gerar recibo: " + err.message); }
  };

  const quickStatus = async (e: Entry, s: Status) => {
    if (e.status === "cancelado" && s === "pago") {
      return toast.error("Lançamento cancelado não pode ser pago. Altere para pendente primeiro.");
    }
    const { data, error } = await supabase.from("financial_entries").update({ status: s }).eq("id", e.id).select().single();
    if (error) return toast.error(safeError(error, "Erro ao carregar financeiro."));
    toast.success("Status atualizado");
    if (s === "pago" && data) {
      await issueReceipt(data as Entry);
    }
    load();
  };

  const clearFilters = () => { setFilterProf("all"); setFilterStatus("all"); setFilterType("all"); setFrom(monthStartISO()); setTo(monthEndISO()); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-primary" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            {canSeeAll ? "Todos os lançamentos da clínica" : "Seus lançamentos"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExportCSV}><FileSpreadsheet className="w-4 h-4 mr-2" /> CSV</Button>
          <Button variant="outline" onClick={onExportPDF}><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo lançamento</Button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-600" /> Receita</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{fmtBRL(totals.receita)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-600" /> Despesa</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{fmtBRL(totals.despesa)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Resultado</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${totals.resultado >= 0 ? "text-primary" : "text-red-700"}`}>{fmtBRL(totals.resultado)}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Recebido</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold text-green-600">{fmtBRL(totals.pago)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Pendente</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold text-amber-600">{fmtBRL(totals.pendente)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Cancelado</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold text-zinc-500">{fmtBRL(totals.cancelado)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {canSeeAll && (
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={filterProf} onValueChange={setFilterProf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? "—"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as EntryType | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.keys(statusMeta) as Status[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum lançamento no período selecionado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Paciente</th>
                  {canSeeAll && <th className="text-left p-3">Profissional</th>}
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Método</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const M = statusMeta[e.status];
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                      <td className="p-3">{patientName(e.patient_id)}</td>
                      {canSeeAll && <td className="p-3">{profName(e.professional_id)}</td>}
                      <td className="p-3">{e.description}</td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">{fmtBRL(Number(e.amount))}</td>
                      <td className="p-3 text-xs">{e.method ? methodLabels[e.method] : "—"}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${M.cls}`}>
                          <M.Icon className="w-3 h-3" /> {M.label}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {e.entry_type === "entrada" && e.status !== "cancelado" && (
                          <Button size="sm" variant="ghost" className="text-primary" title="Cobrar via Pix" onClick={() => setPixEntry(e)}>
                            <QrCode className="w-4 h-4" />
                          </Button>
                        )}
                        {e.status === "pendente" && (
                          <Button size="sm" variant="ghost" className="text-green-700" onClick={() => quickStatus(e, "pago")}>Pagar</Button>
                        )}
                        {e.status === "pago" && (
                          <Button size="sm" variant="ghost" title="Recibo" onClick={() => issueReceipt(e)}><Receipt className="w-4 h-4" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Paciente</Label>
                <Select value={editing.patient_id} onValueChange={(v) => setEditing({ ...editing, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {canSeeAll && (
                <div>
                  <Label>Profissional</Label>
                  <Select value={editing.professional_id} onValueChange={(v) => setEditing({ ...editing, professional_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{professionals.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? "—"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing.entry_type} onValueChange={(v) => setEditing({ ...editing, entry_type: v as EntryType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (receita)</SelectItem>
                      <SelectItem value="saida">Saída (despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Ex.: consulta, aluguel, salários" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Ex.: Sessão de psicoterapia" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={editing.entry_date} onChange={(e) => setEditing({ ...editing, entry_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(statusMeta) as Status[]).map((s) => <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Método</Label>
                  <Select value={editing.method ?? "none"} onValueChange={(v) => setEditing({ ...editing, method: v === "none" ? null : (v as Method) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {(Object.keys(methodLabels) as Method[]).map((m) => <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Análise por Pareto + IA consultiva */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ParetoChart title="Receitas por categoria (Pareto)" data={paretoData.receitas} color="hsl(var(--primary))" />
        <ParetoChart title="Despesas por categoria (Pareto)" data={paretoData.despesas} color="#dc2626" />
      </div>

      <FinancialAdvisor summary={advisorSummary} />

      <PixDialog
        open={!!pixEntry}
        onClose={() => setPixEntry(null)}
        entry={pixEntry ? {
          id: pixEntry.id,
          description: pixEntry.description,
          amount: Number(pixEntry.amount),
          status: pixEntry.status,
          patient_name: patientName(pixEntry.patient_id),
        } : null}
        onPaid={load}
      />
    </div>
  );
}
