import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { financialAdvisor } from "@/lib/ai.functions";

interface Summary {
  periodFrom: string;
  periodTo: string;
  totalReceita: number;
  totalDespesa: number;
  resultado: number;
  ticketMedio: number;
  inadimplencia: number;
  receitaPorCategoria: { category: string; amount: number }[];
  despesaPorCategoria: { category: string; amount: number }[];
  evolucaoMensal: { month: string; receita: number; despesa: number }[];
}

interface Advice {
  diagnosis: string;
  recommendations: { title: string; detail: string; expectedImpact: string }[];
  nextMonthTarget: string;
}

export function FinancialAdvisor({ summary }: { summary: Summary }) {
  const [data, setData] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);
  const call = useServerFn(financialAdvisor);

  const run = async () => {
    setLoading(true); setData(null);
    try {
      const r = await call({ data: { summary } });
      setData(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na consulta");
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Consultor financeiro com IA</h3>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analisando...</> : <><Sparkles className="w-4 h-4 mr-1" /> Consultar IA</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA recebe apenas números agregados (totais por categoria, evolução mensal — sem dados de pacientes) e devolve
          diagnóstico, recomendações e uma sugestão de meta.
        </p>

        {data && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-1">Diagnóstico</h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.diagnosis}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Recomendações</h4>
              <div className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-card">
                    <p className="font-medium text-sm">{i + 1}. {r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.detail}</p>
                    <p className="text-xs mt-1"><strong>Impacto esperado:</strong> {r.expectedImpact}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <strong>Meta para o próximo mês:</strong> {data.nextMonthTarget}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
