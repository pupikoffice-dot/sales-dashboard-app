-- Scope checks for get_mtd_client_ledger / get_mtd_client_invoices / get_mtd_invoice_lines.
-- Run on BETA (qwtfsnkabvbxurwduvyn) as postgres. Read-only; ends by raising an exception that carries the report,
-- so nothing is ever written. Replace the uuids with: an agent-limited user (a25), another agent's user (a27),
-- a user of another company (a55) and a super admin (sa). Expected, from the 2026-10-29 run:
--   A25 ledger cash == sum of agent 25's rep891 lines this month; a client owned only by other agents shows 0 invoices
--   and 0 lines and is not found by search; other company -> 0; p_as is ignored for non-super-admins;
--   super admin "as a25" == a25's own result; anon cannot execute.
do $t$
declare
  a25 uuid := '22a0ed05-525d-4f4f-8c86-e575edf13db7';
  a27 uuid := '5eda06c3-b17a-475c-95f1-fb3839d66def';
  a55 uuid := 'bf41df17-7560-406e-bf3b-d7e675b07e69';
  sa  uuid := '273eee8b-7062-47eb-9859-e6413725d49f';
  out text := '';
  r jsonb; r2 jsonb; cl text; dn text; dt text;
  cy int := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  cm int := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  exp_total numeric; got_total numeric;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a25, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := get_mtd_client_ledger('pupik', null, 200, 0, null);
  select coalesce(sum((x->>'cash')::numeric), 0) into got_total from jsonb_array_elements(r->'rows') x;
  reset role;
  select coalesce(sum(cash), 0) into exp_total from sales_lines
   where company = 'pupik' and line_source ilike 'rep891%' and year = cy and month = cm and agent_erp_id = '25';
  out := out || format('A25 cash got=%s expected=%s ok=%s; ', got_total, exp_total, abs(got_total - exp_total) < 0.01);

  select client_id into cl from sales_lines
   where company = 'pupik' and line_source ilike 'rep891%' and year = cy and month = cm
   group by client_id having bool_and(agent_erp_id <> '25') limit 1;
  select doc_num, doc_type into dn, dt from sales_lines
   where company = 'pupik' and client_id = cl and line_source ilike 'rep891%' and year = cy and month = cm limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', a25, 'role', 'authenticated')::text, true);
  set local role authenticated;
  out := out || format('foreign client invoices=%s lines=%s search=%s; ',
    jsonb_array_length(get_mtd_client_invoices('pupik', cl, null)),
    jsonb_array_length(get_mtd_invoice_lines('pupik', cl, dt, dn, null)),
    jsonb_array_length(get_mtd_client_ledger('pupik', cl, 50, 0, null)->'rows'));
  out := out || format('other company total=%s; ', get_mtd_client_ledger('mt', null, 50, 0, null)->>'total');
  r2 := get_mtd_client_ledger('pupik', null, 200, 0, null);
  out := out || format('p_as ignored (super admin id)=%s (other agent id)=%s; ',
    get_mtd_client_ledger('pupik', null, 200, 0, sa) = r2, get_mtd_client_ledger('pupik', null, 200, 0, a27) = r2);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  out := out || format('SA as a25 == a25 own=%s; ', get_mtd_client_ledger('pupik', null, 200, 0, a25) = r2);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a55, 'role', 'authenticated')::text, true);
  set local role authenticated;
  out := out || format('A55 (mt only) pupik total=%s; ', get_mtd_client_ledger('pupik', null, 50, 0, null)->>'total');
  reset role;

  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    perform get_mtd_client_ledger('pupik', null, 50, 0, null);
    out := out || 'ANON executed (BAD); ';
  exception when others then out := out || 'ANON denied; ';
  end;
  reset role;
  raise exception '%', out;
end $t$;
