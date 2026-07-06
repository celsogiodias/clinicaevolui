
CREATE OR REPLACE FUNCTION public.confirm_appointment_public(_id uuid)
RETURNS TABLE(id uuid, status text, starts_at timestamptz, patient_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT a.id, a.status, a.starts_at, a.patient_id
    INTO v_row
  FROM public.appointments a
  WHERE a.id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.status IN ('cancelado','realizado') THEN
    RAISE EXCEPTION 'Este agendamento não pode mais ser confirmado' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'confirmado' THEN
    UPDATE public.appointments SET status = 'confirmado' WHERE public.appointments.id = _id;
  END IF;

  RETURN QUERY
  SELECT a.id, a.status::text, a.starts_at, p.full_name
  FROM public.appointments a
  LEFT JOIN public.patients p ON p.id = a.patient_id
  WHERE a.id = _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_appointment_public(uuid) TO anon, authenticated;
