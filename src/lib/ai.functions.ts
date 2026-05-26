import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function getKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY não configurado");
  return k;
}

async function callTool<T>(systemPrompt: string, userPrompt: string, toolName: string, schema: Record<string, unknown>): Promise<T> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: { name: toolName, description: "Estruture a resposta", parameters: schema } }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (res.status === 429) throw new Error("Muitas requisições à IA. Aguarde um instante e tente novamente.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione saldo em Settings → Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Erro IA: " + t);
  }
  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("IA não retornou resposta estruturada");
  return JSON.parse(call.function.arguments) as T;
}

// ============================================================
// IA — Análise de evolução do paciente (prontuário psicologia)
// ============================================================
export const analyzePatientEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS já filtra: o psicólogo só vê seus próprios registros (individual_psicologia).
    const { data: records, error } = await supabase
      .from("medical_records")
      .select("record_type, title, content, created_at, created_by")
      .eq("patient_id", data.patientId)
      .eq("scope", "individual_psicologia")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    const own = (records ?? []).filter((r) => r.created_by === userId);
    if (own.length === 0) {
      throw new Error("Nenhum registro próprio encontrado para análise.");
    }

    const corpus = own
      .map((r) => {
        const body = (r.content as { body?: string } | null)?.body ?? "";
        return `[${new Date(r.created_at).toLocaleDateString("pt-BR")}] (${r.record_type}) ${r.title}\n${body}`;
      })
      .join("\n\n---\n\n");

    const system =
      "Você é um(a) psicólogo(a) clínico(a) sênior. Analise registros do prontuário de um paciente (anamnese, hipótese diagnóstica e evoluções) " +
      "e identifique a evolução clínica ao longo do tempo. Seja objetivo(a) e ético(a). Use linguagem profissional em português brasileiro. " +
      "Atribua a cada evolução um índice de 0 a 10 que represente o estado clínico geral percebido naquela sessão (0=pior, 10=melhor). " +
      "Identifique também os 5 temas/categorias mais recorrentes no trabalho terapêutico (ex.: ansiedade, vínculos familiares, autoestima, rotina, etc.).";

    const schema = {
      type: "object",
      properties: {
        narrative: { type: "string", description: "Resumo narrativo da evolução, sinais de melhora/piora, sugestões de foco. 200-400 palavras." },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "Data ISO YYYY-MM-DD" },
              score: { type: "number", minimum: 0, maximum: 10 },
              note: { type: "string", description: "Comentário curto sobre a sessão" },
            },
            required: ["date", "score", "note"],
          },
        },
        topThemes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              theme: { type: "string" },
              count: { type: "number" },
            },
            required: ["theme", "count"],
          },
        },
      },
      required: ["narrative", "sessions", "topThemes"],
    };

    return callTool<{
      narrative: string;
      sessions: { date: string; score: number; note: string }[];
      topThemes: { theme: string; count: number }[];
    }>(system, corpus, "report_evolution", schema);
  });

// ============================================================
// IA — Consultor financeiro
// ============================================================
export const financialAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        summary: z.object({
          periodFrom: z.string(),
          periodTo: z.string(),
          totalReceita: z.number(),
          totalDespesa: z.number(),
          resultado: z.number(),
          ticketMedio: z.number(),
          inadimplencia: z.number(),
          receitaPorCategoria: z.array(z.object({ category: z.string(), amount: z.number() })),
          despesaPorCategoria: z.array(z.object({ category: z.string(), amount: z.number() })),
          evolucaoMensal: z.array(z.object({ month: z.string(), receita: z.number(), despesa: z.number() })),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const system =
      "Você é um(a) consultor(a) de gestão para clínicas multidisciplinares de saúde no Brasil. " +
      "Receberá um resumo financeiro agregado (sem dados pessoais de pacientes). Faça uma análise objetiva, " +
      "identifique oportunidades de ampliação de faturamento, riscos e ineficiências, e proponha de 3 a 5 ações " +
      "práticas, mensuráveis e realistas para os próximos 30-60 dias. Use português brasileiro claro e direto.";

    const userPrompt = JSON.stringify(data.summary, null, 2);

    const schema = {
      type: "object",
      properties: {
        diagnosis: { type: "string", description: "Diagnóstico geral em 2-4 parágrafos." },
        recommendations: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              expectedImpact: { type: "string", description: "Impacto esperado em receita ou economia" },
            },
            required: ["title", "detail", "expectedImpact"],
          },
        },
        nextMonthTarget: { type: "string", description: "Sugestão de meta de faturamento e/ou redução de custos para o mês seguinte" },
      },
      required: ["diagnosis", "recommendations", "nextMonthTarget"],
    };

    return callTool<{
      diagnosis: string;
      recommendations: { title: string; detail: string; expectedImpact: string }[];
      nextMonthTarget: string;
    }>(system, userPrompt, "financial_advice", schema);
  });
