import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

type Status = "pendente" | "pago" | "cancelado";
type Method = "dinheiro" | "pix" | "cartao" | "transferencia" | "convenio" | "outro";

interface Entry {
  id: string;
  description: string;
  amount: number;
  entry_date: string;
  status: Status;
  method: Method | null;
  paid_at: string | null;
  professional_id: string;
}

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

export function FinancialTab({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("financial_entries")
        .select("id, description, amount, entry_date, status, method, paid_at, professional_id")
        .eq("patient_id", patientId)
        .order("entry_date", { ascending: false });
      const ents = (data as Entry[] | null) ?? [];
      setEntries(ents);
      const ids = Array.from(new Set(ents.map((e) => e.professional_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "—"; });
        setProfMap(map);
      }
      setLoading(false);
    })();
  }, [patientId]);

  const totals = useMemo(() => {
    const t = { total: 0, pago: 0, pendente: 0, cancelado: 0 };
    for (const e of entries) {
      const v = Number(e.amount) || 0;
      if (e.status !== "cancelado") t.total += v;
      t[e.status] += v;
    }
    return t;
  }, [entries]);

  if (loading) return <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Total</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{fmtBRL(totals.total)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Recebido</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-green-600">{fmtBRL(totals.pago)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">A receber</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-amber-600">{fmtBRL(totals.pendente)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">Cancelado</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-zinc-500">{fmtBRL(totals.cancelado)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {entries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum lançamento para este paciente.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Profissional</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Método</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const M = statusMeta[e.status];
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                      <td className="p-3">{profMap[e.professional_id] ?? "—"}</td>
                      <td className="p-3">{e.description}</td>
                      <td className="p-3 text-xs">{e.method ? methodLabels[e.method] : "—"}</td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">{fmtBRL(Number(e.amount))}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${M.cls}`}>
                          <M.Icon className="w-3 h-3" /> {M.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
