import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/confirmar/$id")({
  head: () => ({
    meta: [
      { title: "Confirmar consulta — AtivaMente" },
      { name: "description", content: "Confirme sua consulta com um clique." },
    ],
  }),
  component: ConfirmPage,
});

type State =
  | { kind: "loading" }
  | { kind: "ok"; when: string; patient: string }
  | { kind: "error"; msg: string };

function ConfirmPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("confirm_appointment_public", { _id: id });
      if (error) {
        setState({ kind: "error", msg: error.message });
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setState({ kind: "error", msg: "Agendamento não encontrado." });
        return;
      }
      const when = new Date(row.starts_at).toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      });
      setState({ kind: "ok", when, patient: row.patient_name ?? "" });
    })();
  }, [id]);

  return (
    <div className="min-h-screen grid place-items-center p-6" style={{ background: "var(--gradient-hero)" }}>
      <div className="max-w-md w-full bg-card rounded-2xl border p-8 text-center shadow-lg">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-white border shadow-sm grid place-items-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="font-serif italic text-xl text-gradient-brand">AtivaMente</span>
        </div>

        {state.kind === "loading" && (
          <div className="py-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-3">Confirmando sua consulta...</p>
          </div>
        )}

        {state.kind === "ok" && (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h1 className="text-2xl font-bold text-primary">Consulta confirmada!</h1>
            {state.patient && <p className="text-muted-foreground mt-2">Olá, <strong>{state.patient}</strong>.</p>}
            <p className="text-muted-foreground mt-2">
              Sua consulta está confirmada para <strong>{state.when}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-6">
              Se precisar remarcar, entre em contato com a clínica.
            </p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-primary">Não foi possível confirmar</h1>
            <p className="text-muted-foreground mt-2">{state.msg}</p>
            <p className="text-sm text-muted-foreground mt-6">
              Entre em contato com a clínica para regularizar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
