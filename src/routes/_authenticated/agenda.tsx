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
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, CheckCircle2, XCircle, RefreshCcw, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type Status = "pendente" | "confirmado" | "nao_confirmado" | "remarcado" | "cancelado" | "realizado";

interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  notes: string | null;
}

interface PatientRow { id: string; full_name: string }
interface ProfRow { user_id: string; full_name: string | null; role: string }

const statusMeta: Record<Status, { label: string; dot: string; bg: string; ring: string }> = {
  confirmado:      { label: "Confirmado",     dot: "bg-green-500",   bg: "bg-green-50 border-green-300",   ring: "ring-green-500/30" },
  nao_confirmado:  { label: "Não confirmado", dot: "bg-red-500",     bg: "bg-red-50 border-red-300",       ring: "ring-red-500/30" },
  remarcado:       { label: "Remarcado",      dot: "bg-orange-500",  bg: "bg-orange-50 border-orange-300", ring: "ring-orange-500/30" },
  pendente:        { label: "Pendente",       dot: "bg-slate-400",   bg: "bg-slate-50 border-slate-300",   ring: "ring-slate-400/30" },
  cancelado:       { label: "Cancelado",      dot: "bg-zinc-400",    bg: "bg-zinc-100 border-zinc-300 line-through opacity-60", ring: "ring-zinc-400/30" },
  realizado:       { label: "Realizado",      dot: "bg-teal-600",    bg: "bg-teal-50 border-teal-300",     ring: "ring-teal-500/30" },
};

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Dom
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(d: Date) { return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }); }
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterProf, setFilterProf] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const load = async () => {
    setLoading(true);
    const [{ data: apps }, { data: pats }, { data: profs }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", weekEnd.toISOString())
        .order("starts_at"),
      supabase.from("patients").select("id, full_name").order("full_name"),
      supabase.rpc("get_professionals_for_agenda"),
    ]);
    setAppointments((apps as Appointment[] | null) ?? []);
    setPatients((pats as PatientRow[] | null) ?? []);
    setProfessionals(((profs as ProfRow[] | null) ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart]);

  const openNew = (date?: Date) => {
    const base = date ?? new Date();
    base.setMinutes(0, 0, 0);
    if (!date) base.setHours(Math.max(8, base.getHours()));
    const end = new Date(base); end.setHours(base.getHours() + 1);
    setEditing({
      id: "", patient_id: "", professional_id: "",
      starts_at: base.toISOString(), ends_at: end.toISOString(),
      status: "pendente", notes: "",
    });
    setDialogOpen(true);
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const filtered = appointments.filter((a) => {
    if (filterProf !== "all" && a.professional_id !== filterProf) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });
  const appsByDay = (d: Date) =>
    filtered
      .filter((a) => {
        const s = new Date(a.starts_at);
        return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate();
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const patientName = (id: string) => patients.find((p) => p.id === id)?.full_name ?? "—";
  const profName = (id: string) => professionals.find((p) => p.user_id === id)?.full_name ?? "—";

  const updateStatus = async (a: Appointment, status: Status) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Agenda</h1>
          <p className="text-sm text-muted-foreground">Agendamentos e horários disponíveis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-1" /> Novo agendamento
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["confirmado","nao_confirmado","remarcado","pendente","realizado","cancelado"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusMeta[s].dot}`} />
            {statusMeta[s].label}
          </span>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-card">
        <div className="min-w-[200px]">
          <Label className="text-xs">Profissional</Label>
          <Select value={filterProf} onValueChange={setFilterProf}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px]">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(statusMeta) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusMeta[s].dot}`} />
                    {statusMeta[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterProf !== "all" || filterStatus !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterProf("all"); setFilterStatus("all"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="text-sm font-medium text-muted-foreground">
        Semana de {weekStart.toLocaleDateString("pt-BR")} a {addDays(weekStart, 6).toLocaleDateString("pt-BR")}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((d) => {
            const items = appsByDay(d);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={d.toISOString()} className={`rounded-lg border bg-card p-3 min-h-[180px] ${isToday ? "ring-2 ring-primary/30" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm capitalize">{fmtDate(d)}</p>
                  <button onClick={() => openNew(d)} className="text-muted-foreground hover:text-primary" title="Adicionar">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Livre</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((a) => {
                      const meta = statusMeta[a.status];
                      const s = new Date(a.starts_at);
                      const e = new Date(a.ends_at);
                      const time = `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}–${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`;
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setEditing(a); setDialogOpen(true); }}
                          className={`w-full text-left p-2 rounded border text-xs ${meta.bg} hover:ring-2 ${meta.ring} transition`}
                        >
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className={`w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
                            <span>{time}</span>
                          </div>
                          <div className="font-medium truncate mt-0.5">{patientName(a.patient_id)}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{profName(a.professional_id)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        appointment={editing}
        patients={patients}
        professionals={professionals}
        onSaved={load}
        onQuickStatus={updateStatus}
      />
    </div>
  );
}

function AppointmentDialog({
  open, onClose, appointment, patients, professionals, onSaved, onQuickStatus,
}: {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  patients: PatientRow[];
  professionals: ProfRow[];
  onSaved: () => void;
  onQuickStatus: (a: Appointment, s: Status) => void;
}) {
  const [form, setForm] = useState<Appointment | null>(appointment);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(appointment); }, [appointment]);

  if (!form) return null;
  const isNew = !form.id;

  const save = async () => {
    if (!form.patient_id || !form.professional_id) {
      toast.error("Selecione paciente e profissional");
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("Horário de término deve ser após o início");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (isNew) {
      const { error } = await supabase.from("appointments").insert({
        patient_id: form.patient_id,
        professional_id: form.professional_id,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        status: form.status,
        notes: form.notes,
        created_by: user.id,
      });
      if (error) toast.error(error.message); else { toast.success("Agendamento criado"); onSaved(); onClose(); }
    } else {
      const { error } = await supabase.from("appointments").update({
        patient_id: form.patient_id,
        professional_id: form.professional_id,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        status: form.status,
        notes: form.notes,
      }).eq("id", form.id);
      if (error) toast.error(error.message); else { toast.success("Atualizado"); onSaved(); onClose(); }
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm("Excluir este agendamento?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", form.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onSaved(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo agendamento" : "Editar agendamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Paciente</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profissional</Label>
            <Select value={form.professional_id} onValueChange={(v) => setForm({ ...form, professional_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name ?? p.user_id} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input
                type="datetime-local"
                value={toLocalInput(new Date(form.starts_at))}
                onChange={(e) => setForm({ ...form, starts_at: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div>
              <Label>Término</Label>
              <Input
                type="datetime-local"
                value={toLocalInput(new Date(form.ends_at))}
                onChange={(e) => setForm({ ...form, ends_at: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(statusMeta) as Status[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusMeta[s].dot}`} />
                      {statusMeta[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>

          {!isNew && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => onQuickStatus(form, "confirmado")}>
                <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" /> Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => onQuickStatus(form, "nao_confirmado")}>
                <XCircle className="w-4 h-4 mr-1 text-red-600" /> Não confirmou
              </Button>
              <Button size="sm" variant="outline" onClick={() => onQuickStatus(form, "remarcado")}>
                <RefreshCcw className="w-4 h-4 mr-1 text-orange-600" /> Remarcado
              </Button>
              <Button size="sm" variant="outline" onClick={() => onQuickStatus(form, "realizado")}>
                <Clock className="w-4 h-4 mr-1 text-teal-600" /> Realizado
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!isNew && (
            <Button variant="ghost" onClick={remove} className="text-destructive mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
