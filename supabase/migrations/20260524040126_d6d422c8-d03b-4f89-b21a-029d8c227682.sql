
CREATE OR REPLACE FUNCTION public.handle_financial_entry_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.status = 'pago' AND OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Lançamento cancelado não pode ser marcado como pago. Reative-o primeiro alterando para pendente.';
  END IF;

  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  IF NEW.status <> 'pago' THEN
    NEW.paid_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_financial_entry_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    NEW.paid_at = NULL;
  END IF;
  IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_entry_insert ON public.financial_entries;
CREATE TRIGGER trg_financial_entry_insert
BEFORE INSERT ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_financial_entry_insert();

DROP TRIGGER IF EXISTS trg_financial_entry_update ON public.financial_entries;
CREATE TRIGGER trg_financial_entry_update
BEFORE UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_financial_entry_update();
