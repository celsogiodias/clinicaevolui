import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — AtivaMente" },
      { name: "description", content: "Escolha um profissional, dia e horário. Agendamento online, rápido e seguro." },
    ],
  }),
  component: PublicBooking,
});

interface Prof { user_id: string; full_name: string | null; role: string }

const HORARIOS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

function PublicBooking() {
  const [profs, setProfs] = useState<Prof[]>([]);
  const [profId, setProfId] = useState<string>("");
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState<string>("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observ, setObserv] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [enviado, setEnviado] = useState<{ hora: string; prof: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const wanted = new Set(["psicologo", "profissional"]);
      const ids = (roles ?? []).filter((r: any) => wanted.has(r.role)).map((r: any) => r.user_id);
      if (ids.length === 0) return;
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      setProfs(
        (roles ?? [])
          .filter((r: any) => wanted.has(r.role))
          .map((r: any) => ({ user_id: r.user_id, full_name: map.get(r.user_id) ?? "Profissional", role: r.role }))
      );
    })();
  }, []);

  useEffect(() => {
    if (!profId || !data) return;
    (async () => {
      const start = `${data}T00:00:00`;
      const end = `${data}T23:59:59`;
      const { data: appts } = await supabase
        .from("appointments")
        .select("starts_at")
        .eq("professional_id", profId)
        .gte("starts_at", start)
        .lte("starts_at", end);
      setOcupados((appts ?? []).map((a: any) => a.starts_at.slice(11, 16)));
    })();
  }, [profId, data]);

  const disponiveis = useMemo(
    () => HORARIOS.filter((h) => !ocupados.includes(h)),
    [ocupados]
  );

  async function submeter() {
    if (!profId || !hora || !nome.trim() || !telefone.trim()) {
      toast.error("Preencha profissional, horário, nome e telefone");
      return;
    }
    setLoading(true);
    try {
      // busca paciente por telefone; se não existir, cria
      const { data: existente } = await supabase
        .from("patients")
        .select("id")
        .eq("phone", telefone)
        .maybeSingle();

      let patientId = existente?.id;
      if (!patientId) {
        const { data: novo, error: errP } = await supabase
          .from("patients")
          .insert({ full_name: nome, phone: telefone, email: email || null })
          .select("id")
          .single();
        if (errP) throw errP;
        patientId = novo.id;
      }

      const starts = `${data}T${hora}:00`;
      const [h, m] = hora.split(":").map(Number);
      const endsH = String(h + 1).padStart(2, "0");
      const ends = `${data}T${endsH}:${String(m).padStart(2, "0")}:00`;

      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId,
        professional_id: profId,
        created_by: profId,
        starts_at: starts,
        ends_at: ends,
        status: "pendente",
        notes: observ || null,
      });

      if (error) throw error;

      const prof = profs.find((p) => p.user_id === profId);
      setEnviado({ hora, prof: prof?.full_name ?? "" });
    } catch (err: any) {
      toast.error(err.message ?? "Não foi possível concluir o agendamento");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen grid place-items-center p-6" style={{ background: "var(--gradient-hero)" }}>
        <div className="max-w-md w-full bg-card rounded-2xl border p-8 text-center shadow-lg">
          <CheckCircle2 className="w-14 h-14 mx-auto text-accent mb-4" />
          <h1 className="text-2xl font-bold text-primary">Solicitação enviada!</h1>
          <p className="text-muted-foreground mt-2">
            Recebemos seu pedido de agendamento com <strong>{enviado.prof}</strong> em{" "}
            <strong>{new Date(`${data}T${enviado.hora}`).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}</strong>.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Você receberá uma confirmação em breve pelo WhatsApp ({telefone}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="mx-auto max-w-3xl px-6 py-6 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-white border shadow-sm grid place-items-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <span className="font-serif italic text-xl text-gradient-brand">AtivaMente</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-4 py-1.5 text-xs text-muted-foreground mb-4">
            <CalendarDays className="w-3.5 h-3.5 text-accent" />
            Agendamento online
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary">
            Agende sua consulta em <span className="font-serif italic text-gradient-brand">poucos cliques</span>
          </h1>
          <p className="text-muted-foreground mt-3">
            Escolha o profissional, o melhor dia e horário. Simples e seguro.
          </p>
        </div>

        <div className="bg-card border rounded-2xl shadow-lg p-6 md:p-8 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={profId} onValueChange={setProfId}>
                <SelectTrigger><SelectValue placeholder="Escolha o profissional" /></SelectTrigger>
                <SelectContent>
                  {profs.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {profId && (
            <div className="space-y-2">
              <Label>Horários disponíveis</Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {HORARIOS.map((h) => {
                  const livre = disponiveis.includes(h);
                  const ativo = hora === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={!livre}
                      onClick={() => setHora(h)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        !livre
                          ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                          : ativo
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-card hover:bg-accent/10 hover:border-accent"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Seu nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Email (opcional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações (opcional)</Label>
              <Textarea rows={3} value={observ} onChange={(e) => setObserv(e.target.value)} placeholder="Algo que a clínica precisa saber antes da consulta?" />
            </div>
          </div>

          <Button
            onClick={submeter}
            disabled={loading}
            size="lg"
            className="w-full btn-gold btn-gold-hover rounded-full h-12 text-base"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Solicitar agendamento
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Sua solicitação passa por confirmação da clínica. Você recebe a confirmação pelo WhatsApp.
          </p>
        </div>
      </main>
    </div>
  );
}
