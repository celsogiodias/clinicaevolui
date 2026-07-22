// Mapa de erros conhecidos para mensagens amigáveis
const ERROR_MAP: Record<string, string> = {
  "invalid input syntax for type uuid": "Registro não encontrado.",
  "duplicate key value violates unique constraint": "Já existe um registro com esses dados.",
  "insert or update on table": "Erro ao salvar. Verifique os dados.",
  "JWT expired": "Sessão expirada. Faça login novamente.",
  "Failed to fetch": "Erro de conexão. Verifique sua internet.",
  "NetworkError": "Erro de conexão. Verifique sua internet.",
  "new row violates row-level security": "Você não tem permissão para essa ação.",
  "permission denied": "Você não tem permissão para essa ação.",
  "relation" : "Erro interno do sistema.",
  "TypeError": "Erro inesperado. Tente novamente.",
  "Muitas requisições": "Muitas requisições. Aguarde e tente novamente.",
  "Créditos de IA esgotados": "Limite de uso da IA atingido.",
}
/**
 * Converte qualquer erro em uma mensagem segura para exibir ao usuário.
 * Nunca expõe detalhes técnicos, SQL, stack trace ou estrutura interna.
 */
export function safeError(error: unknown, fallback = "Erro inesperado. Tente novamente."): string {
  if (!error) return fallback
  const message = typeof error === "string" 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error)
  // Procura no mapa
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }
  // Se tem message mas não está no mapa, retorna fallback genérico
  return fallback
}
