CREATE OR REPLACE FUNCTION public.get_professionals_for_agenda()
RETURNS TABLE(user_id uuid, full_name text, role public.app_role)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, p.full_name, ur.role
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('admin'::public.app_role, 'psicologo'::public.app_role, 'profissional'::public.app_role)
  ORDER BY p.full_name;
END;
$$;