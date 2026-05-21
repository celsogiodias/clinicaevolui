-- Fix search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke public execute on SECURITY DEFINER funcs
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Tighten patient policies (explicit authenticated check)
DROP POLICY "Usuários logados atualizam pacientes" ON public.patients;
DROP POLICY "Usuários logados excluem pacientes" ON public.patients;

CREATE POLICY "Usuários logados atualizam pacientes" ON public.patients
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários logados excluem pacientes" ON public.patients
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);