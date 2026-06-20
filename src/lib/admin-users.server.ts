import { supabaseAdmin } from '../integrations/supabase/client.server';

export type ProfissionalRole = 'administrador' | 'psicologo' | 'profissional' | 'administrativo';

export interface ProfissionalData {
  id: string;
  nome: string;
  email: string;
  papel: ProfissionalRole;
  created_at?: string;
}

export async function listarProfissionais(): Promise<ProfissionalData[]> {
  const { data, error } = await supabaseAdmin
    .from('profissionais')
    .select('id, nome, email, papel, created_at')
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao listar profissionais: ${error.message}`);
  return data ?? [];
}

export async function criarProfissional(dados: {
  nome: string;
  email: string;
  papel: ProfissionalRole;
}): Promise<ProfissionalData> {
  const { data, error } = await supabaseAdmin
    .from('profissionais')
    .insert({
      nome: dados.nome,
      email: dados.email,
      papel: dados.papel,
    })
    .select('id, nome, email, papel, created_at')
    .single();

  if (error) throw new Error(`Erro ao criar profissional: ${error.message}`);
  return data;
}

export async function atualizarProfissional(
  id: string,
  dados: { nome?: string; email?: string; papel?: ProfissionalRole }
): Promise<ProfissionalData> {
  const { data, error } = await supabaseAdmin
    .from('profissionais')
    .update(dados)
    .eq('id', id)
    .select('id, nome, email, papel, created_at')
    .single();

  if (error) throw new Error(`Erro ao atualizar profissional: ${error.message}`);
  return data;
}

export async function excluirProfissional(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profissionais')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Erro ao excluir profissional: ${error.message}`);
}
