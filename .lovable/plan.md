## Fase 3 — Prontuários

### O que será entregue

**1. Equipe do paciente**
- Nova tela "Equipe" dentro do paciente onde o **admin** vincula profissionais (psicólogos e profissionais de saúde/educação) ao paciente.
- Só quem está vinculado consegue ver/escrever no prontuário daquele paciente.
- Administrativo **nunca** vê prontuário (apenas dados cadastrais e, futuramente, agenda/financeiro).

**2. Prontuário individual de psicologia**
Aba dentro do paciente, visível apenas para **psicólogos vinculados** e admin. Contém:
- **Anamnese** (formulário estruturado: queixa, histórico, medicações, antecedentes)
- **Hipótese diagnóstica** (campo CID + plano terapêutico)
- **Evoluções/sessões** (lista cronológica: data + texto livre, cada entrada com autor)
- **Documentos CFP 06/2019** (modelos editáveis: Declaração, Atestado, Relatório, Laudo, Parecer — texto livre baseado nos campos exigidos pela resolução; você poderá ajustar os modelos depois)

**3. Prontuário multidisciplinar**
Aba separada, visível para **todos os profissionais vinculados** ao paciente (psicólogo + profissional de saúde/educação) e admin. Contém:
- Evoluções multidisciplinares (data + texto + autor + área/especialidade)
- Visível a toda a equipe vinculada, para garantir continuidade do cuidado.

**4. Anexos / Upload de documentos**
- Cada prontuário pode ter PDFs anexados (laudos externos, exames, etc.)
- Armazenamento privado, só acessível a quem tem permissão no prontuário.

**5. Exportar para PDF**
- Todo documento (anamnese, evolução, laudo, etc.) tem botão "Exportar PDF" — gera PDF no navegador para impressão.
- Para o **papel timbrado**: após você anexar a imagem do timbrado, eu integro como cabeçalho/rodapé dos PDFs.

---

### Regras de acesso (resumo)

| Perfil | Cadastro do paciente | Prontuário individual (psico) | Prontuário multi | Anexos |
|---|---|---|---|---|
| Admin | Tudo | Tudo | Tudo | Tudo |
| Psicólogo vinculado | Ver/Editar | Ver/Editar | Ver/Editar | Ver/Enviar |
| Profissional vinculado | Ver | **Não vê** | Ver/Editar | Ver/Enviar |
| Administrativo | Ver dados cadastrais | **Bloqueado** | **Bloqueado** | **Bloqueado** |

---

### Detalhes técnicos (para referência)

- Novas tabelas: `patient_team`, `medical_records` (com `scope: individual_psicologia | multidisciplinar` e `record_type: anamnese | evolucao | diagnostico | documento_cfp`), `record_attachments`.
- Bucket privado de Storage `patient-documents` com policies vinculadas a `patient_team`.
- RLS via função `has_patient_access(patient_id, scope)` (SECURITY DEFINER) para evitar recursão.
- Exportação PDF client-side via `jspdf` + `html2canvas` (sem dependência de serviço externo).
- Telas em `/patients/$id` ganham abas: **Dados**, **Equipe** (admin), **Prontuário Psicologia**, **Prontuário Multi**, **Documentos**.

---

### Próximo passo

Se aprovar este plano, eu já começo a implementação. Os **modelos da Resolução CFP 06/2019** vou montar com base no que é exigido oficialmente (você pode editar depois). Sobre o **papel timbrado**: pode anexar a imagem (PNG/JPG) na próxima mensagem que eu integro junto.
