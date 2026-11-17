# Database types (stage 1)

The Postgres schema is the contract between the loaders, web app, mobile app, admin app and edge functions.
TypeScript types for it are **generated**, never written by hand.

| File | Purpose |
|---|---|
| `src/types/database.generated.ts` | Generated from the BETA database on 2026-11-17: 74 tables, 121 functions. Do not edit. |
| `src/types/db.ts` | Small helpers: `Row<'table'>`, `InsertOf<'table'>`, `RpcArgs<'fn'>`, `RpcReturns<'fn'>`. |
| `src/lib/supabase.ts` | `supabase` (untyped, as before) and `db` (same client, typed). |

## Use in new code

```ts
import { db } from '../lib/supabase'
const { data } = await db.from('item_catalog').select('sku, tablet_cat') // table and columns are checked
```

A wrong table, column or RPC name is now a compile error instead of a runtime failure.

## Regenerate (after every migration, BETA first)

Either use the Supabase tooling `supabase gen types typescript --project-id qwtfsnkabvbxurwduvyn > src/types/database.generated.ts`
(then add back the header comment), or ask Claude Code to regenerate it through the Supabase connector.
Commit it together with the migration.

## Why existing code is NOT switched yet

Typing the global `supabase` client was trialled on 2026-11-17: it produces **30 compile errors in 16 files**. Almost all are
RPC calls that pass `null` where the generated type says "omit the argument" (`string | undefined`).
Those are not safe to bulk-edit: in Postgres, omitting an argument uses the function's `DEFAULT`, while passing `null` passes NULL,
and the two can behave differently. Each call site needs a check against its function, then an edit. The rest are calls to RPC names held in
a variable (`chainAdmin`, `grossMarginApi`, `orderPlanning`, `purchaseCards`) and JSON results cast to a specific shape.

Migration path: move one file at a time from `supabase` to `db`, check the function's default, fix the type, test on BETA.
Track progress below.

### Files still on the untyped client with known mismatches
SmReceiptsReportModal, useOpsDeliveries, categoryControl, chainAdmin, clientItemSales, dataHealth/api, grossMarginApi, intercompanyApi,
loadFromSupabase, mtdLedger, orderPlanning, oversightClassLayoutApi, purchaseCards, yearlyDetail, yearlyOverview.
