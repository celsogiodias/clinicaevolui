import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Cabeçalho */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            ESPAÇO TERAPÊUTICO ATIVAMENTE LTDA · 17 de julho de 2026
          </p>
        </div>

        {/* Seções */}
        <div className="space-y-8 text-gray-700 leading-relaxed">

          <Section title="1. Identificação do Controlador">
            <p>
              A presente Política de Privacidade descreve como a{" "}
              <strong>ESPAÇO TERAPÊUTICO ATIVAMENTE LTDA</strong>, inscrita no{" "}
              <strong>CNPJ nº 65.378.431/0001-31</strong>, com sede na{" "}
              <strong>
                Praça Jose Ramalho de Lima, 50, Perpétuo Socorro, Belo Oriente/MG
              </strong>
              , doravante denominada apenas como "ESPAÇO ATIVAMENTE", coleta,
              armazena, utiliza e protege os dados pessoais de seus usuários e
              pacientes, em conformidade com a Lei Geral de Proteção de Dados
              Pessoais (Lei nº 13.709/2018 — LGPD).
            </p>
          </Section>

          <Section title="2. Definições">
            <p>
              Para fins desta Política, aplicam-se as seguintes definições:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Dado Pessoal:</strong> Informação relacionada a pessoa
                natural identificada ou identificável.
              </li>
              <li>
                <strong>Dado Pessoal Sensível:</strong> Dado pessoal sobre
                origem racial ou étnica, convicção religiosa, opinião política,
                filiação a sindicato, dado referente à saúde ou à vida sexual,
                dado genético ou biométrico.
              </li>
              <li>
                <strong>Titular:</strong> Pessoa natural a quem se referem os
                dados pessoais que são objeto de tratamento.
              </li>
              <li>
                <strong>Controlador:</strong> Pessoa jurídica a quem competem as
                decisões referentes ao tratamento de dados pessoais.
              </li>
              <li>
                <strong>Operador:</strong> Pessoa natural ou jurídica que
                realiza o tratamento de dados pessoais em nome do controlador.
              </li>
              <li>
                <strong>Consentimento:</strong> Manifestação livre, informada e
                inequívoca pela qual o titular concorda com o tratamento de seus
                dados.
              </li>
              <li>
                <strong>ANPD:</strong> Autoridade Nacional de Proteção de Dados.
              </li>
            </ul>
          </Section>

          <Section title="3. Que dados coletamos">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Dados de identificação:</strong> Nome completo, RG, CPF,
                data de nascimento, estado civil e profissão.
              </li>
              <li>
                <strong>Dados de contato:</strong> E-mail, telefone e WhatsApp.
              </li>
              <li>
                <strong>Dados de saúde (sensíveis):</strong> Anamneses,
                diagnósticos, evoluções clínicas, histórico terapêutico,
                relatórios psicológicos, conteúdo de sessões.
              </li>
              <li>
                <strong>Dados financeiros:</strong> Informações de pagamento,
                histórico de cobranças, convênios.
              </li>
              <li>
                <strong>Dados de acesso:</strong> Logs de navegação, endereço
                IP, tipo de dispositivo.
              </li>
            </ul>
          </Section>

          <Section title="4. Base legal para tratamento">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Dados sensíveis de saúde:</strong> Consentimento
                específico e destacado (Art. 11, I) e tutela da saúde (Art. 11,
                II, "f").
              </li>
              <li>
                <strong>Dados cadastrais:</strong> Execução de contrato (Art.
                7º, V) e legítimo interesse (Art. 7º, IX).
              </li>
              <li>
                <strong>Dados financeiros:</strong> Execução de contrato e
                obrigação legal (Art. 7º, II e V).
              </li>
            </ul>
          </Section>

          <Section title="5. Finalidades do tratamento">
            <ul className="list-disc pl-6 space-y-1">
              <li>Prestação de serviços de psicologia e gestão clínica.</li>
              <li>Agendamento de consultas e envio de lembretes.</li>
              <li>Faturamento e gestão financeira.</li>
              <li>
                Cumprimento de obrigações legais (CFP, CRP).
              </li>
              <li>
                Melhoria dos serviços com dados anonimizados.
              </li>
            </ul>
          </Section>

          <Section title="6. Compartilhamento de dados">
            <p>
              O ESPAÇO ATIVAMENTE não comercializa dados pessoais. O
              compartilhamento ocorre apenas quando necessário com:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Supabase:</strong> Infraestrutura de banco de dados
                (servidores nos EUA).
              </li>
              <li>
                <strong>Operadoras de pagamento:</strong> Processamento de
                transações.
              </li>
              <li>
                <strong>Autoridades legais:</strong> Requisição judicial ou
                obrigação legal.
              </li>
              <li>
                <strong>Profissionais de saúde:</strong> Acesso restrito aos
                vinculados ao atendimento do paciente.
              </li>
            </ul>
          </Section>

          <Section title="7. Transferência internacional de dados">
            <p>
              Os dados são armazenados em servidores do Supabase nos Estados
              Unidos, com garantias contratuais de proteção compatíveis com a
              LGPD.
            </p>
          </Section>

          <Section title="8. Armazenamento e segurança">
            <p>
              Adotamos criptografia em trânsito, controles de acesso rigorosos e
              monitoramento contínuo da infraestrutura, conforme Art. 46 da
              LGPD.
            </p>
          </Section>

          <Section title="9. Prazo de retenção">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Prontuários:</strong> Mínimo de 5 anos após o último
                atendimento (Res. CFP 01/2009).
              </li>
              <li>
                <strong>Dados cadastrais:</strong> Durante a relação contratual.
              </li>
              <li>
                <strong>Logs de acesso:</strong> 6 meses (Marco Civil da
                Internet).
              </li>
            </ul>
          </Section>

          <Section title="10. Direitos do titular (Art. 18 LGPD)">
            <p>O titular possui direito a:</p>
            <ol className="list-decimal pl-6 space-y-1 mt-2">
              <li>Confirmação da existência de tratamento.</li>
              <li>Acesso aos dados.</li>
              <li>Correção de dados incompletos ou inexatos.</li>
              <li>Anonimização, bloqueio ou eliminação.</li>
              <li>Portabilidade dos dados.</li>
              <li>Eliminação dos dados tratados com consentimento.</li>
              <li>Informação sobre entidades com quem compartilhamos.</li>
              <li>Informação sobre possibilidade de não fornecer consentimento.</li>
              <li>Revogação do consentimento.</li>
            </ol>
            <p className="mt-2">
              Para exercer seus direitos, envie e-mail para:{" "}
              <a
                href="mailto:ativapsimente@gmail.com"
                className="text-blue-600 underline"
              >
                ativapsimente@gmail.com
              </a>
            </p>
          </Section>

          <Section title="11. Encarregado de Dados (DPO)">
            <p>
              E-mail do DPO:{" "}
              <a
                href="mailto:ativapsimente@gmail.com"
                className="text-blue-600 underline"
              >
                ativapsimente@gmail.com
              </a>
            </p>
          </Section>

          <Section title="12. Consentimento">
            <p>
              Ao utilizar a plataforma, o titular declara estar ciente das
              práticas descritas nesta Política. Dados sensíveis de saúde
              exigem Termo de Consentimento específico.
            </p>
          </Section>

          <Section title="13. Cookies">
            <p>
              Utilizamos cookies estritamente necessários para segurança e
              funcionamento da plataforma.
            </p>
          </Section>

          <Section title="14. Disposições gerais">
            <p>
              Esta Política pode ser alterada a qualquer momento. Alterações
              serão comunicadas via plataforma ou e-mail.
            </p>
          </Section>

          <Section title="15. Contato">
            <p>
              Para questões relacionadas à privacidade:{" "}
              <a
                href="mailto:ativapsimente@gmail.com"
                className="text-blue-600 underline"
              >
                ativapsimente@gmail.com
              </a>
            </p>
          </Section>
        </div>

        {/* Rodapé */}
        <div className="mt-12 pt-6 border-t text-center text-xs text-gray-400">
          <p>ESPAÇO TERAPÊUTICO ATIVAMENTE LTDA · CNPJ 65.378.431/0001-31</p>
          <p className="mt-1">
            Documento protegido pela Lei nº 13.709/2018 (LGPD)
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  )
}
