# Not the source of truth

Schema for this project lives in **one** place:

    Mobile App for salesteam/supabase/migrations/

The `.sql` files that used to sit here were applied by hand in the Supabase SQL
editor and were never tracked as migrations. That drift was real: the `20260813*`
migrations referenced `dashboard_user_access.show_item_cost` / `show_client_profit`,
but nothing in the migrations directory ever created those columns, so a clean
replay of the directory would fail. Four live functions -- `get_dashboard_aux`,
`get_dashboard_sales_boundaries`, `get_dashboard_sales_page` and
`resolve_dashboard_login` -- existed only in production, in a scratch file, or
nowhere at all.

They were captured verbatim on 2026-08-18 (bodies verified byte-identical against
production via `md5(prosrc)`) as:

- `20260812000000_capture_access_flag_columns.sql`  (back-dated: the 20260813* files depend on these columns)
- `20260812000100_capture_username_login.sql`
- `20260818100000_capture_dashboard_aux.sql`
- `20260818100100_capture_sales_boundaries_and_page.sql`

The originals are kept in `_applied_archive/` for provenance only. Do not run them,
and do not add new `.sql` files here -- add a migration instead.
