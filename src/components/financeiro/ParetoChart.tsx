import { Card, CardContent } from "@/components/ui/card";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Item { category: string; amount: number }

interface Props {
  title: string;
  data: Item[];
  color: string;
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ParetoChart({ title, data, color }: Props) {
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, i) => s + i.amount, 0);
  let acc = 0;
  const enriched = sorted.map((i) => {
    acc += i.amount;
    return {
      category: i.category || "Sem categoria",
      amount: i.amount,
      cumulative: total > 0 ? Math.round((acc / total) * 100) : 0,
    };
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Barras = valor por categoria · Linha = % cumulativo (regra 80/20)
        </p>
        {enriched.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={enriched}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name === "cumulative" ? `${v}%` : fmtBRL(v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="amount" name="Valor" fill={color} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" name="% cumulativo" stroke="#dc2626" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
