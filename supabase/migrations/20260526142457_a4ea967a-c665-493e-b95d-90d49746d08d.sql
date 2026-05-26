
-- ============================================================
-- FASE 9: Especialidades profissionais (papéis dinâmicos)
-- ============================================================
CREATE TABLE public.professional_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  default_role app_role NOT NULL DEFAULT 'profissional',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.professional_specialties TO authenticated;
GRANT ALL ON public.professional_specialties TO service_role;

ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem especialidades"
  ON public.professional_specialties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia especialidades"
  ON public.professional_specialties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sementes iniciais
INSERT INTO public.professional_specialties (name, default_role, is_system) VALUES
  ('Administrador',        'admin',         true),
  ('Psicólogo(a)',         'psicologo',     true),
  ('Terapeuta Ocupacional','profissional',  true),
  ('Fisioterapeuta',       'profissional',  true),
  ('Fonoaudiólogo(a)',     'profissional',  true),
  ('Psicopedagogo(a)',     'profissional',  true),
  ('Secretária(o)',        'administrativo',true),
  ('Outros',               'profissional',  true);

-- Vínculo do profile com a especialidade
ALTER TABLE public.profiles ADD COLUMN specialty_id UUID REFERENCES public.professional_specialties(id);

-- ============================================================
-- FASE 7a: Perfil profissional (carimbo, assinatura, conselho)
-- ============================================================
CREATE TABLE public.professional_profiles (
  user_id UUID PRIMARY KEY,
  council_type TEXT,
  council_number TEXT,
  stamp_path TEXT,
  signature_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profiles TO authenticated;
GRANT ALL ON public.professional_profiles TO service_role;

ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais veem seus perfis e admin vê todos"
  ON public.professional_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Profissional cria próprio perfil"
  ON public.professional_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profissional atualiza próprio perfil"
  ON public.professional_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin gerencia perfis profissionais"
  ON public.professional_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_prof_profiles_updated
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- FASE 7b: Bucket privado para carimbos/assinaturas
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('professional-assets', 'professional-assets', false);

CREATE POLICY "Profissional vê próprios arquivos profissionais"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'professional-assets'
         AND (auth.uid()::text = (storage.foldername(name))[1]
              OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Profissional envia próprios arquivos profissionais"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'professional-assets'
              AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Profissional atualiza próprios arquivos profissionais"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'professional-assets'
         AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Profissional deleta próprios arquivos profissionais"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'professional-assets'
         AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- FASE 7c: Privacidade do prontuário individual de psicologia
-- ============================================================
DROP POLICY IF EXISTS "Ver prontuários conforme escopo" ON public.medical_records;
DROP POLICY IF EXISTS "Editar prontuários conforme escopo" ON public.medical_records;

CREATE POLICY "Ver prontuários conforme escopo e autoria"
  ON public.medical_records FOR SELECT TO authenticated
  USING (
    public.has_patient_access(auth.uid(), patient_id, scope)
    AND (
      scope = 'multidisciplinar'
      OR auth.uid() = created_by
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Editar prontuários conforme escopo e autoria"
  ON public.medical_records FOR UPDATE TO authenticated
  USING (
    public.has_patient_access(auth.uid(), patient_id, scope)
    AND (
      scope = 'multidisciplinar'
      OR auth.uid() = created_by
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    public.has_patient_access(auth.uid(), patient_id, scope)
    AND (
      scope = 'multidisciplinar'
      OR auth.uid() = created_by
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ============================================================
-- FASE 10: Financeiro com entradas e saídas + categoria
-- ============================================================
CREATE TYPE public.financial_type AS ENUM ('entrada', 'saida');

ALTER TABLE public.financial_entries
  ADD COLUMN entry_type public.financial_type NOT NULL DEFAULT 'entrada',
  ADD COLUMN category TEXT;

-- Garante que registros existentes ficam como entrada
UPDATE public.financial_entries SET entry_type = 'entrada' WHERE entry_type IS NULL;
