-- Enums
CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'cancelado');
CREATE TYPE public.payment_method AS ENUM ('dinheiro', 'pix', 'cartao', 'transferencia', 'convenio', 'outro');

-- Tabela
CREATE TABLE public.financial_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  appointment_id UUID NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.payment_status NOT NULL DEFAULT 'pendente',
  method public.payment_method NULL,
  paid_at TIMESTAMP WITH TIME ZONE NULL,
  notes TEXT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_entries_professional ON public.financial_entries(professional_id);
CREATE INDEX idx_financial_entries_patient ON public.financial_entries(patient_id);
CREATE INDEX idx_financial_entries_date ON public.financial_entries(entry_date);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "Admin gerencia financeiro" ON public.financial_entries
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Administrativo: tudo
CREATE POLICY "Administrativo vê financeiro" ON public.financial_entries
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'administrativo'));

CREATE POLICY "Administrativo cria financeiro" ON public.financial_entries
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrativo') AND auth.uid() = created_by);

CREATE POLICY "Administrativo edita financeiro" ON public.financial_entries
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'administrativo'))
WITH CHECK (public.has_role(auth.uid(), 'administrativo'));

CREATE POLICY "Administrativo exclui financeiro" ON public.financial_entries
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'administrativo'));

-- Profissional/Psicologo: apenas próprios
CREATE POLICY "Profissional vê próprio financeiro" ON public.financial_entries
FOR SELECT TO authenticated
USING (auth.uid() = professional_id);

CREATE POLICY "Profissional cria próprio financeiro" ON public.financial_entries
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = professional_id AND auth.uid() = created_by);

CREATE POLICY "Profissional edita próprio financeiro" ON public.financial_entries
FOR UPDATE TO authenticated
USING (auth.uid() = professional_id)
WITH CHECK (auth.uid() = professional_id);

-- Trigger updated_at + auto paid_at
CREATE OR REPLACE FUNCTION public.handle_financial_entry_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  IF NEW.status <> 'pago' THEN
    NEW.paid_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_financial_entries_update
BEFORE UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_financial_entry_update();

CREATE OR REPLACE FUNCTION public.handle_financial_entry_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_financial_entries_insert
BEFORE INSERT ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_financial_entry_insert();