-- Fase 3: Prontuários (individual psicologia + multidisciplinar)

-- Enums
CREATE TYPE public.record_scope AS ENUM ('individual_psicologia', 'multidisciplinar');
CREATE TYPE public.record_type AS ENUM ('anamnese', 'evolucao', 'diagnostico', 'documento_cfp');

-- Equipe vinculada ao paciente
CREATE TABLE public.patient_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, user_id)
);

CREATE INDEX idx_patient_team_user ON public.patient_team(user_id);
CREATE INDEX idx_patient_team_patient ON public.patient_team(patient_id);

ALTER TABLE public.patient_team ENABLE ROW LEVEL SECURITY;

-- Prontuários
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scope public.record_scope NOT NULL,
  record_type public.record_type NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medical_records_patient ON public.medical_records(patient_id, scope, created_at DESC);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_medical_records_updated
BEFORE UPDATE ON public.medical_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Anexos
CREATE TABLE public.record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_record_attachments_record ON public.record_attachments(record_id);

ALTER TABLE public.record_attachments ENABLE ROW LEVEL SECURITY;

-- Função de acesso ao prontuário (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_patient_access(_user_id UUID, _patient_id UUID, _scope public.record_scope)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_team BOOLEAN;
  is_psico BOOLEAN;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.patient_team
    WHERE patient_id = _patient_id AND user_id = _user_id
  ) INTO is_team;

  IF NOT is_team THEN
    RETURN FALSE;
  END IF;

  IF _scope = 'multidisciplinar' THEN
    -- Qualquer membro vinculado (psicólogo ou profissional)
    RETURN public.has_role(_user_id, 'psicologo') OR public.has_role(_user_id, 'profissional');
  ELSE
    -- individual_psicologia: somente psicólogo
    RETURN public.has_role(_user_id, 'psicologo');
  END IF;
END;
$$;

-- Função: tem QUALQUER acesso ao paciente (para anexos)
CREATE OR REPLACE FUNCTION public.has_any_patient_access(_user_id UUID, _patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.patient_team
    WHERE patient_id = _patient_id AND user_id = _user_id
  );
$$;

-- ===== RLS patient_team =====
CREATE POLICY "Admins gerenciam equipe" ON public.patient_team
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Membros veem suas vinculações" ON public.patient_team
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ===== RLS medical_records =====
CREATE POLICY "Ver prontuários conforme escopo" ON public.medical_records
FOR SELECT TO authenticated
USING (public.has_patient_access(auth.uid(), patient_id, scope));

CREATE POLICY "Criar prontuários conforme escopo" ON public.medical_records
FOR INSERT TO authenticated
WITH CHECK (
  public.has_patient_access(auth.uid(), patient_id, scope)
  AND auth.uid() = created_by
);

CREATE POLICY "Editar prontuários conforme escopo" ON public.medical_records
FOR UPDATE TO authenticated
USING (public.has_patient_access(auth.uid(), patient_id, scope))
WITH CHECK (public.has_patient_access(auth.uid(), patient_id, scope));

CREATE POLICY "Admin exclui prontuários" ON public.medical_records
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== RLS record_attachments =====
CREATE POLICY "Ver anexos conforme prontuário" ON public.record_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.medical_records mr
    WHERE mr.id = record_id
      AND public.has_patient_access(auth.uid(), mr.patient_id, mr.scope)
  )
);

CREATE POLICY "Enviar anexos conforme prontuário" ON public.record_attachments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.medical_records mr
    WHERE mr.id = record_id
      AND public.has_patient_access(auth.uid(), mr.patient_id, mr.scope)
  )
);

CREATE POLICY "Admin exclui anexos" ON public.record_attachments
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== Função: equipe com perfis =====
CREATE OR REPLACE FUNCTION public.get_patient_team(_patient_id UUID)
RETURNS TABLE (
  team_id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role public.app_role,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR EXISTS (SELECT 1 FROM public.patient_team WHERE patient_id = _patient_id AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT pt.id, pt.user_id, p.full_name, p.email,
         COALESCE(ur.role, 'administrativo'::public.app_role), pt.created_at
  FROM public.patient_team pt
  LEFT JOIN public.profiles p ON p.id = pt.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = pt.user_id
  WHERE pt.patient_id = _patient_id
  ORDER BY pt.created_at;
END;
$$;

-- ===== Storage bucket privado =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Caminho: {patient_id}/{record_id}/{filename}
CREATE POLICY "Ler anexos do paciente"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND public.has_any_patient_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Enviar anexos do paciente"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND public.has_any_patient_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Admin remove anexos do paciente"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND public.has_role(auth.uid(), 'admin')
);