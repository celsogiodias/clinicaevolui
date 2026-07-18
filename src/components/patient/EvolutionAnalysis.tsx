import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyzePatientEvolution } from "@/lib/ai.functions";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { safeError } from "@/lib/safe-errors"


interface Result {
  narrative: string;
  sessions: { date: string; score: number; note: string }[];
  topThemes: { theme: string; count: number }[];
}

export function EvolutionAnalysis({ patientId }: { patientId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const call = useServerFn(analyzePatientEvolution);

  const run = async () => {
    setLoading(true); setData(null);
    try {
      const r = await call({ data: { patientId } });
      setData(r);
    } catch (e: any) {
      toast.error(safeError(e, "Falha na análise"));
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Análise de evolução com IA</h3>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analisando...</> : <><Sparkles className="w-4 h-4 mr-1" /> Gerar análise</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA lê apenas os seus próprios registros deste paciente (anamnese, hipótese e evoluções) e devolve um resumo da evolução
          + gráficos. Nenhum dado é armazenado pela IA.
        </p>

        {data && (
          <div className="space-y-5">
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.narrative}</p>
            </div>

            {data.sessions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Índice de evolução por sessão (0 a 10)</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <LineChart data={data.sessions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {data.topThemes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Temas mais trabalhados</h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer>
                    <BarChart data={data.topThemes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="theme" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
