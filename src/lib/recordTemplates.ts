// Modelos editáveis. Texto base — o usuário ajusta livremente.

export type RecordType = "anamnese" | "evolucao" | "diagnostico" | "documento_cfp";

export const recordTypeLabels: Record<RecordType, string> = {
  anamnese: "Anamnese",
  evolucao: "Evolução / Sessão",
  diagnostico: "Hipótese Diagnóstica",
  documento_cfp: "Documento (CFP 06/2019)",
};

export const templates: Record<RecordType, { title: string; body: string }> = {
  anamnese: {
    title: "Anamnese",
    body: `IDENTIFICAÇÃO
Nome:
Idade:
Data de nascimento:
Estado civil:
Profissão:
Encaminhamento:

QUEIXA PRINCIPAL


HISTÓRICO DA QUEIXA ATUAL
(Início, evolução, fatores associados)


HISTÓRICO PESSOAL
(Desenvolvimento, escolaridade, relacionamentos, trabalho)


HISTÓRICO FAMILIAR
(Composição familiar, relações, histórico de saúde mental)


HISTÓRICO MÉDICO E MEDICAÇÕES


TRATAMENTOS ANTERIORES


HÁBITOS (sono, alimentação, atividade física, uso de substâncias)


IMPRESSÕES INICIAIS DO(A) PROFISSIONAL
`,
  },
  evolucao: {
    title: `Evolução - ${new Date().toLocaleDateString("pt-BR")}`,
    body: `Data da sessão:
Modalidade (presencial/online):
Duração:

RELATO DA SESSÃO


INTERVENÇÕES REALIZADAS


PLANEJAMENTO PARA PRÓXIMA SESSÃO
`,
  },
  diagnostico: {
    title: "Hipótese Diagnóstica",
    body: `CID-10/11:

HIPÓTESE DIAGNÓSTICA


JUSTIFICATIVA CLÍNICA


PLANO TERAPÊUTICO
(Objetivos, abordagem, frequência, prognóstico)


REAVALIAÇÃO PREVISTA
`,
  },
  documento_cfp: {
    title: "Documento",
    body: `Selecione o modelo abaixo, ou escreva livremente.

Modelos disponíveis (conforme Resolução CFP nº 06/2019):
- DECLARAÇÃO: confirma comparecimento, sem conteúdo clínico
- ATESTADO PSICOLÓGICO: afirma estado psicológico do avaliado
- RELATÓRIO PSICOLÓGICO: descrição clara de procedimentos e resultados
- LAUDO PSICOLÓGICO: avaliação aprofundada com conclusão diagnóstica
- PARECER PSICOLÓGICO: resposta a uma demanda específica

------------------------------------------------------------
Exemplo de cabeçalho:

DECLARAÇÃO

Eu, [Nome do(a) Psicólogo(a)], CRP nº [XX/XXXXX], declaro
para os devidos fins que [Nome do paciente], portador(a) do
documento [RG/CPF], compareceu a atendimento psicológico
no dia [DD/MM/AAAA], no horário de [HH:MM] às [HH:MM].

Sem mais para o momento.

[Cidade], [DD] de [mês] de [AAAA].

___________________________________
[Nome do(a) Psicólogo(a)]
CRP nº [XX/XXXXX]
`,
  },
};
