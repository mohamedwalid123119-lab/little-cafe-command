
CREATE OR REPLACE FUNCTION public.purchase_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_new_status
    FROM public.purchases
    WHERE id = NEW.purchase_id;

    IF v_new_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'لا يمكن إضافة أصناف إلا لفاتورة مسودة';
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_old_status
    FROM public.purchases
    WHERE id = OLD.purchase_id;

    IF v_old_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'لا يمكن حذف أصناف من فاتورة مستلمة أو ملغاة';
    END IF;

    RETURN OLD;

  ELSE
    SELECT status INTO v_old_status
    FROM public.purchases
    WHERE id = OLD.purchase_id;

    SELECT status INTO v_new_status
    FROM public.purchases
    WHERE id = NEW.purchase_id;

    IF v_old_status IS DISTINCT FROM 'draft'
       OR v_new_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'لا يمكن نقل أو تعديل أصناف فاتورة مستلمة أو ملغاة';
    END IF;

    RETURN NEW;
  END IF;
END
$function$;
