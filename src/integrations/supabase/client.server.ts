import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ]
    const message = `Variáveis de ambiente Supabase ausentes: ${missing.join(', ')}`
    console.error(`[Supabase] ${message}`)
    throw new Error(message)
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Cliente admin já instanciado e pronto pra usar
export const supabaseAdmin = createSupabaseAdminClient()
