@"
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createSupabaseAdminClient } from '../integrations/supabase/client.server';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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
    const { userId, data: updateData } = parsed.data;
    const adminClient = createSupabaseAdminClient();
    const errors: string[] = [];
    if (updateData.fullName) {
      const { error: profileError } = await adminClient.from('profiles').update({ full_name: updateData.fullName }).eq('id', userId);
      if (profileError) errors.push('Erro ao atualizar perfil: ' + profileError.message);
    }
    if (updateData.role) {
      await adminClient.from('user_roles').delete().eq('user_id', userId);
      const { error: insertError } = await adminClient.from('user_roles').insert({ user_id: userId, role: updateData.role as AppRole });
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
    const { userId } = parsed.data;
    const adminClient = createSupabaseAdminClient();
    const errors: string[] = [];
    for (const table of ['user_roles', 'professional_profiles']) {
      const { error } = await adminClient.from(table as any).delete().eq('user_id', userId);
      if (error) errors.push('Erro ao remover ' + table + ': ' + error.message);
    }
    const { error: profileError } = await adminClient.from('profiles').delete().eq('id', userId);
    if (profileError) errors.push('Erro ao remover perfil: ' + profileError.message);
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) errors.push('Erro ao remover usuário auth: ' + authError.message);
    if (errors.length > 0) return { success: false, message: errors.join(' | ') };
    return { success: true, message: 'Profissional excluído com sucesso.' };
  });
"@ | Out-File -FilePath "src/lib/admin-users.server.ts" -Encoding UTF8 -Force
