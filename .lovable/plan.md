## Fase 7 — Prontuário digital com assinatura/carimbo + privacidade reforçada

**Mudança de regra de acesso (importante):**
Hoje qualquer psicólogo vinculado à equipe enxerga os documentos individuais. Você pediu que **documentos psicológicos só sejam vistos pelo próprio autor**, exceto o multidisciplinar. Vou ajustar a RLS para:
- `medical_records` com `scope = individual_psicologia` → visível **apenas para o autor** (`created_by = auth.uid()`) + admin.
- `scope = multidisciplinar` → continua visível a toda a equipe vinculada.
- Admin continua vendo tudo.

**Assinatura/carimbo do profissional:**
- Nova aba **"Meu perfil profissional"** (menu lateral) onde cada profissional cadastra:
  - Nº do conselho (CRP, CREFITO, CREFONO, etc.)
  - Carimbo digital (upload PNG transparente, opcional)
  - Assinatura digital (upload PNG transparente, opcional)
- Tabela nova: `professional_profile` (user_id, council_number, council_type, stamp_url, signature_url).
- PDF gerado passa a incluir automaticamente carimbo + assinatura + nome + nº do conselho no rodapé.

**Organização CFP 06/2019 na ficha do paciente:**
A aba "Prontuário Psicologia" passa a ter subseções organizadas conforme a resolução:
1. **Anamnese** (existente)
2. **Hipótese diagnóstica / Avaliação** (existente)
3. **Evoluções** (existente — sessões cronológicas)
4. **Documentos formais** (subseção dedicada, organizada por tipo):
   - Declarações
   - Atestados psicológicos
   - Relatórios
   - Laudos
   - Pareceres
   Cada tipo vira uma "gaveta" separada com os documentos daquele tipo.

---

## Fase 8 — IA que lê o prontuário e mostra evolução

- Botão **"Análise de evolução com IA"** dentro da aba Prontuário Psicologia.
- A IA (Lovable AI — Gemini, gratuito dentro da cota) lê todas as evoluções + anamnese + diagnóstico daquele paciente e retorna:
  - **Texto narrativo**: resumo da evolução, temas recorrentes, sinais de melhora/piora, sugestões de foco.
  - **Gráfico**: linha do tempo com um "índice de evolução" (0-10) que a IA atribui a cada sessão, mais um gráfico de barras dos temas/categorias mais trabalhados.
- Privacidade: só o psicólogo autor (ou admin) consegue rodar a análise. Dados não são armazenados pela IA.
- Implementação via `createServerFn` chamando o Gateway Lovable AI; gráficos com Recharts.

---

## Fase 9 — Papéis dinâmicos definidos pelo admin

Hoje os papéis são fixos no enum do banco: admin / psicologo / profissional / administrativo. Você pediu para o admin definir: **administrador, psicólogo, TO, fisioterapia, fono, psicopedagogia, secretária, outros**.

Como vou resolver sem quebrar tudo:
- Mantenho o **enum técnico** com 4 categorias de permissão (admin, psicologo, profissional, administrativo) — é o que controla o acesso aos prontuários e à agenda.
- Crio uma tabela nova `professional_specialties` (id, name) que o admin gerencia (CRUD livre — pode adicionar TO, fisio, fono, psicopedagogia, etc.).
- Cada usuário recebe **uma especialidade** (rótulo livre, ex: "Terapeuta Ocupacional") **e** uma categoria de permissão (ex: "profissional").
- Na tela de "Usuários", o admin escolhe **a especialidade** (rótulo) + **o tipo de acesso** (admin / psicólogo / profissional / secretária).
- Sementes iniciais: admin, psicólogo, TO, fisioterapia, fonoaudiologia, psicopedagogia, secretária, outros.

Mapa de permissão automático:
- Psicólogo → categoria `psicologo` (vê individual + multi)
- TO, fisio, fono, psicopedagogia → categoria `profissional` (vê multi)
- Secretária → categoria `administrativo` (não vê prontuário)
- Admin/outros → admin define

---

## Fase 10 — Financeiro: entradas, saídas, Pareto, IA consultiva

**Entradas e saídas:**
- Hoje `financial_entries` só tem entradas implícitas. Vou adicionar coluna `type` (`entrada` | `saida`) e `category` (texto livre, ex: aluguel, salários, materiais, consulta, plano, particular).
- Tela financeiro ganha: filtro entrada/saída, totalizadores (Receita, Despesa, **Resultado** = receita − despesa) no topo.

**Gráfico de Pareto:**
- Novo painel "Análise" no financeiro com:
  - **Pareto de receitas por categoria** (barras + linha cumulativa 80/20) — mostra quais serviços/clientes geram 80% da receita.
  - **Pareto de despesas por categoria** — mostra onde está concentrado o gasto.
- Implementado com Recharts (ComposedChart).

**IA consultiva financeira:**
- Botão **"Consultor IA"** que envia para o Gemini um resumo agregado (totais por categoria, evolução mensal, ticket médio, taxa de inadimplência) e devolve:
  - Diagnóstico (onde está a oportunidade e o risco)
  - 3 a 5 recomendações práticas para aumentar faturamento e melhorar gestão
  - Sugestão de meta para o próximo mês
- Sem dados pessoais de paciente — só agregados financeiros.

---

## Ordem de execução proposta

1. **Fase 9 primeiro** (papéis dinâmicos) — porque afeta os cadastros de usuários e algumas telas.
2. **Fase 7** (assinatura/carimbo + privacidade + organização CFP).
3. **Fase 10** (financeiro entradas/saídas + Pareto + IA consultiva).
4. **Fase 8** (IA evolutiva do prontuário).

---

## Confirme antes de eu começar:

1. **Acesso individual ao prontuário psicológico**: confirma que **só o psicólogo autor + admin** veem? (Hoje qualquer psicólogo da equipe vê — isso é uma mudança importante.)
2. **Carimbo e assinatura**: você prefere upload de imagem (PNG) ou texto digitado/desenhado na tela? (Recomendo upload — mais simples e oficial.)
3. **IA**: posso usar Lovable AI (gratuita até a cota) por padrão? Sem chave externa.
4. **Ordem**: tudo bem começar pela Fase 9 (papéis)?