-- Status do agendamento
CREATE TYPE public.appointment_status AS ENUM ('pendente', 'confirmado', 'nao_confirmado', 'remarcado', 'cancelado', 'realizado');

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_starts_at ON public.appointments(starts_at);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id, starts_at);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id, starts_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER set_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Policies
-- Admin: tudo
CREATE POLICY "Admin gerencia agenda"
  ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Administrativo: pode ver/criar/editar agenda (sem prontuário)
CREATE POLICY "Administrativo vê agenda"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrativo'));

CREATE POLICY "Administrativo cria agendamentos"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrativo') AND auth.uid() = created_by);

CREATE POLICY "Administrativo edita agendamentos"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrativo'))
  WITH CHECK (public.has_role(auth.uid(), 'administrativo'));

-- Profissionais vêem/editam seus próprios atendimentos
CREATE POLICY "Profissional vê próprios agendamentos"
  ON public.appointments FOR SELECT TO authenticated
  USING (auth.uid() = professional_id);

CREATE POLICY "Profissional cria próprios agendamentos"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = professional_id AND auth.uid() = created_by);

CREATE POLICY "Profissional edita próprios agendamentos"
  ON public.appointments FOR UPDATE TO authenticated
  USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);