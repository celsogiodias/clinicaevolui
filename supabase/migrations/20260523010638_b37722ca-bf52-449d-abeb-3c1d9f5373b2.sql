-- 1) Restringir EXECUTE das SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_patient_access(uuid, uuid, public.record_scope) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_patient_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_users_with_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_team(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_professionals_for_agenda() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_patient_access(uuid, uuid, public.record_scope) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_patient_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professionals_for_agenda() TO authenticated;

-- 2) Validação de sobreposição de agendamentos
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND a.status <> 'cancelado'
      AND a.starts_at < NEW.ends_at
      AND a.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'Este profissional já possui um agendamento nesse horário';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_appointment_overlap ON public.appointments;
CREATE TRIGGER trg_check_appointment_overlap
BEFORE INSERT OR UPDATE OF starts_at, ends_at, professional_id, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_overlap();