@"
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createSupabaseAdminClient } from '../integrations/supabase/client.server';
import type { Database } from '../integrations/supabase/types';
import { parseCookies } from 'vinxi/http';

type AppRole = Database['public']['Enums']['app_role'];

function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function getSupabaseAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  // Tenta todos os padrões possíveis de cookie do Supabase
  const patterns = [
    /sb-[^-]+-auth-token=([^;]+)/,
    /sb-access-token=([^;]+)/,
    /supabase-auth-token=([^;]+)/,
  ];
  for (const pattern of patterns) {
    const match = cookieHeader.match(pattern);
    if (match) {
      try {
        // O token pode vir URL-encoded ou como JSON array
        const raw = decodeURIComponent(match[1]);
        // Se for um array JSON [access_token, ...], pega o primeiro
        if (raw.startsWith('[')) {
          const parsed = JSON.parse(raw);
          return parsed[0];
        }
        return raw;
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

async function ensureAdmin(request: Request): Promise<{ userId: string } | { error: string }> {
  const token = getSupabaseAuthToken(request);
  if (!token) {
    return { error: 'Usuário não autenticado.' };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  
  if (userError || !userData.user) {
    return { error: 'Usuário não autenticado.' };
  }

  const currentUserId = userData.user.id;
  const { data: roleData, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUserId)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError || !roleData) {
    return { error: 'Acesso negado. Apenas administradores podem executar esta ação.' };
  }

  return { userId: currentUserId };
}

const InviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(['psicologo', 'profissional', 'administrativo']),
});

const UpdateSchema = z.object({
  userId: z.string().uuid(),
  data: z.object({
    fullName: z.string().min(1).optional(),
    role: z.enum(['admin', 'psicologo', 'profissional', 'administrativo']).optional(),
  }),
});

const DeleteSchema = z.object({ userId: z.string().uuid() });

export const inviteProfessional = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, userId: null, message: 'Dados inválidos: ' + parsed.error.message };
    }
    const data = parsed.data;

    const adminCheck = await ensureAdmin(request);
    if ('error' in adminCheck) {
      return { success: false, userId: null, message: adminCheck.error };
    }
    const adminClient = createSupabaseAdminClient();
    const password = generatePassword(8);
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email, password, email_confirm: true,
    });
    if (authError || !authData.user) {
      return { success: false, userId: null, message: 'Erro ao criar usuário: ' + (authError?.message ?? 'desconhecido') };
    }
    const userId = authData.user.id;
    const { error: profileError } = await adminClient.from('profiles').insert({ id: userId, full_name: data.fullName, email: data.email });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return { success: false, userId: null, message: 'Erro ao criar perfil: ' + profileError.message };
    }
    const { error: roleError } = await adminClient.from('user_roles').insert({ user_id: userId, role: data.role as AppRole });
    if (roleError) {
      await adminClient.from('profiles').delete().eq('id', userId);
      await adminClient.auth.admin.deleteUser(userId);
      return { success: false, userId: null, message: 'Erro ao atribuir papel: ' + roleError.message };
    }
    return { success: true, userId, message: 'Profissional convidado com sucesso.' };
  });

export const updateProfessional = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, message: 'Dados inválidos: ' + parsed.error.message };
    }
    const data = parsed.data;

    const adminCheck = await ensureAdmin(request);
    if ('error' in adminCheck) return { success: false, message: adminCheck.error };
    const adminClient = createSupabaseAdminClient();
    const errors: string[] = [];
    if (data.data.fullName) {
      const { error: profileError } = await adminClient.from('profiles').update({ full_name: data.data.fullName }).eq('id', data.userId);
      if (profileError) errors.push('Erro ao atualizar perfil: ' + profileError.message);
    }
    if (data.data.role) {
      await adminClient.from('user_roles').delete().eq('user_id', data.userId);
      const { error: insertError } = await adminClient.from('user_roles').insert({ user_id: data.userId, role: data.data.role as AppRole });
      if (insertError) errors.push('Erro ao atribuir novo papel: ' + insertError.message);
    }
    if (errors.length > 0) return { success: false, message: errors.join(' | ') };
    return { success: true, message: 'Profissional atualizado com sucesso.' };
  });

export const deleteProfessional = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const body = await request.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, message: 'Dados inválidos: ' + parsed.error.message };
    }
    const data = parsed.data;

    const adminCheck = await ensureAdmin(request);
    if ('error' in adminCheck) return { success: false, message: adminCheck.error };
    if (data.userId === adminCheck.userId) return { success: false, message: 'Você não pode excluir sua própria conta.' };
    const adminClient = createSupabaseAdminClient();
    const errors: string[] = [];
    for (const table of ['user_roles', 'professional_profiles']) {
      const { error } = await adminClient.from(table as any).delete().eq('user_id', data.userId);
      if (error) errors.push('Erro ao remover ' + table + ': ' + error.message);
    }
    const { error: profileError } = await adminClient.from('profiles').delete().eq('id', data.userId);
    if (profileError) errors.push('Erro ao remover perfil: ' + profileError.message);
    const { error: authError } = await adminClient.auth.admin.deleteUser(data.userId);
    if (authError) errors.push('Erro ao remover usuário auth: ' + authError.message);
    if (errors.length > 0) return { success: false, message: errors.join(' | ') };
    return { success: true, message: 'Profissional excluído com sucesso.' };
  });
"@ | Out-File -FilePath "src/lib/admin-users.server.ts" -Encoding UTF8 -Force
