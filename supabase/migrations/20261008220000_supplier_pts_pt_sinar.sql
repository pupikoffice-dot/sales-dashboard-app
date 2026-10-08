-- PTS was labeled Pit toys. The supplier name for that prefix is PT Sinar.
update public.supplier_prefix
set supplier_name = 'PT Sinar',
    updated_at = now()
where prefix = 'PTS';
