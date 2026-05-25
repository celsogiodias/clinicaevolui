import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, CheckCircle2, Phone, AlertCircle, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lembretes")({
  component: LembretesPage,
});

interface Reminder {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  professional_id: string;
  patient: { id: string; full_name: string; phone: string | null } | null;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
}

type Window = "24h" | "2h";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

/** Normaliza telefone para formato wa.me (somente dígitos, com 55 se faltar DDI). */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Se já vier com DDI (12+ dígitos), usa direto. Caso contrário, prefixa Brasil 55.
  return digits.length >= 12 ? digits : `55${digits}`;
}

function buildMessage(patientName: string, startsAt: string, professional: string | null, window: Window) {
  const dia = fmtDateOnly(startsAt);
  const hora = fmtTime(startsAt);
  const primeiroNome = patientName.split(" ")[0];
  const prof = professional ? ` com ${professional}` : "";
  if (window === "24h") {
    return `Olá, ${primeiroNome}! Passando para lembrar da sua consulta amanhã, ${dia}, às ${hora}${prof}. Podemos confirmar?`;
  }
  return `Olá, ${primeiroNome}! Sua consulta é hoje às ${hora}${prof}. Estamos te esperando!`;
}

function LembretesPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<Reminder[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});

  const load = async () => {
    setRefreshing(true);
    const now = new Date();
    const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000); // pega 24h + folga
    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, professional_id, reminder_24h_sent_at, reminder_2h_sent_at, patient:patients(id, full_name, phone)")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", in26h.toISOString())
      .not("status", "in", "(cancelado,realizado)")
      .order("starts_at");

    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Buscar nomes dos profissionais
    const ids = Array.from(new Set((appts ?? []).map((a: any) => a.professional_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? ""; });
      setProfMap(map);
    }

    const rows: Reminder[] = (appts ?? []).map((a: any) => ({
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      patient: a.patient,
      professional_name: null,
      reminder_24h_sent_at: a.reminder_24h_sent_at,
      reminder_2h_sent_at: a.reminder_2h_sent_at,
    }));
    setData(rows);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const { window24h, window2h } = useMemo(() => {
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2h30 janela
    const in22h = new Date(now.getTime() + 22 * 60 * 60 * 1000);
    const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const w2h: Reminder[] = [];
    const w24h: Reminder[] = [];
    for (const r of data) {
      const t = new Date(r.starts_at).getTime();
      if (t >= now.getTime() && t <= in2h.getTime()) w2h.push(r);
      else if (t >= in22h.getTime() && t <= in26h.getTime()) w24h.push(r);
    }
    return { window24h: w24h, window2h: w2h };
  }, [data]);

  const handleSend = async (r: Reminder, window: Window) => {
    if (!r.patient) return;
    const phone = normalizePhone(r.patient.phone);
    if (!phone) {
      toast.error("Paciente sem telefone cadastrado");
      return;
    }
    const prof = profMap[ (r as any).professional_id ?? "" ] ?? null;
    const msg = buildMessage(r.patient.full_name, r.starts_at, prof, window);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window === "24h"
      ? null
      : null;
    // Abre WhatsApp
    globalThis.open(url, "_blank", "noopener,noreferrer");
  };

  const markSent = async (r: Reminder, window: Window) => {
    const field = window === "24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";
    const { error } = await supabase
      .from("appointments")
      .update({ [field]: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Marcado como enviado");
    load();
  };

  const renderRow = (r: Reminder, window: Window) => {
    const sent = window === "24h" ? r.reminder_24h_sent_at : r.reminder_2h_sent_at;
    const hasPhone = !!normalizePhone(r.patient?.phone ?? null);
    const profName = (() => {
      const pid = (r as any).professional_id;
      return pid ? profMap[pid] : null;
    })();
    return (
      <Card key={`${r.id}-${window}`} className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{r.patient?.full_name ?? "Paciente"}</span>
              {sent && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Enviado {fmtTime(sent)}
                </Badge>
              )}
              {!hasPhone && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" /> Sem telefone
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {fmtDateTime(r.starts_at)}
              {profName && <> · com {profName}</>}
            </div>
            {r.patient?.phone && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {r.patient.phone}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleSend(r, window)}
              disabled={!hasPhone}
              className="bg-[#25D366] hover:bg-[#1ebe57] text-white"
            >
              <MessageCircle className="w-4 h-4 mr-1" /> Enviar WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => markSent(r, window)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar enviado
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando lembretes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lembretes</h1>
          <p className="text-muted-foreground mt-1">
            Envie lembretes de consulta via WhatsApp. Sem custos, sem APIs externas.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Consultas em ~2h (hoje)</h2>
          <Badge variant="secondary">{window2h.length}</Badge>
        </div>
        {window2h.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta nas próximas 2h30.</p>
        ) : (
          <div className="space-y-2">{window2h.map((r) => renderRow(r, "2h"))}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Consultas em ~24h (amanhã)</h2>
          <Badge variant="secondary">{window24h.length}</Badge>
        </div>
        {window24h.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta na janela de 22h a 26h.</p>
        ) : (
          <div className="space-y-2">{window24h.map((r) => renderRow(r, "24h"))}</div>
        )}
      </section>

      <Card className="p-4 bg-muted/50 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Como funciona</p>
        <p>
          Ao clicar em <strong>Enviar WhatsApp</strong>, abrimos o WhatsApp Web/App
          com o número do paciente e a mensagem já pronta. Você só precisa clicar
          em enviar dentro do WhatsApp. Depois, clique em <strong>Marcar enviado</strong>{" "}
          para registrar no sistema.
        </p>
      </Card>
    </div>
  );
}
