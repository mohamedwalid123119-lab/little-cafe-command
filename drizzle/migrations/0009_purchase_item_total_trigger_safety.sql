
CREATE OR REPLACE FUNCTION public.purchase_item_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_pid := NEW.purchase_id;

  ELSIF TG_OP = 'DELETE' THEN
    v_pid := OLD.purchase_id;

  ELSE
    IF OLD.purchase_id IS DISTINCT FROM NEW.purchase_id THEN
      UPDATE public.purchases
         SET total_amount = COALESCE(
           (
             SELECT SUM(purchase_total)
             FROM public.purchase_items
             WHERE purchase_id = OLD.purchase_id
           ),
           0
         )
       WHERE id = OLD.purchase_id;
    END IF;

    v_pid := NEW.purchase_id;
  END IF;

  UPDATE public.purchases
     SET total_amount = COALESCE(
       (
         SELECT SUM(purchase_total)
         FROM public.purchase_items
         WHERE purchase_id = v_pid
       ),
       0
     )
   WHERE id = v_pid;

  RETURN NULL;
END
$function$;
