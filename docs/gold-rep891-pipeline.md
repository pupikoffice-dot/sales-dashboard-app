# Goldbug (rep891) — why September looked empty

## What the web app expects

Supabase sync loads **`rep891gold.xls`** from Google Drive (filename must contain `gold` or `goldbug`). Rows land in `sales_lines` with `company = gold`. Classic Oversight **Sales MTD**, **Top 10**, and **Suppliers** all filter `company === 'gold'` and the current calendar month.

## Automatic ERP batch (Finansit)

The scheduled-style batch in:

`R:\Dropbox\03-18-2012\Pupik Operation\Biz-Dev\2026- Biz\Data - Biz dev\data\REP BDS organizational Examine group.BAT`

runs reports **887, 888, 889, 720, 721** for Pupik / MT / Grow / Gold — but **does not run report 891 for any company**, including Goldbug (`gold2025` DB).

So **891 is not produced by that BAT**. Pupik/MT/Grow 891 files on `\\srv\office\Biz-Dev\Data\` must come from another export path (manual ERP, different job, or older automation not in this repo).

## Excel dashboard refresh (legacy JSON path)

`Dashboard\refresh_dashboard.bat` → `refresh_dashboard.ps1` → `serverdashboardexcel.xlsm`.

Inside the workbook, **`UpdateServerDashboard`** (`Module1.bas`) imports from `\\srv\office\Biz-Dev\Data\`:

- `rep891pupik.xls`, `rep891mt.xls`, `rep891grow.xls`, year variants — **no `rep891gold.xls`**

**`ExportToJSON`** (`ExportDashboardData.bas`) reads the same set — **no Gold 891 sheets**.

The **Supabase hourly sync** (`Mobile App for salesteam\sync\run_sync.bat`) can ingest `rep891gold.xls` from Drive if ops upload it, but nothing in the BAT + Module1 chain refreshes that file automatically.

## September 2026 specifically

If Goldbug showed zero for September:

1. Confirm **`rep891gold.xls`** exists on Drive / data share and contains September lines.
2. Confirm sync log shows `Processing [sales/gold]: rep891gold.xls` (not `SKIP (unknown company)`).
3. Add **891 to the Gold ERP batch** (see below) or run 891 manually for `gold2025` and copy the export to `rep891gold.xls` on the share + Drive.

## Recommended ops fix

1. Add to `REP BDS organizational Examine group.BAT` (after other Gold lines):

   `"C:\Program Files (x86)\Almog\\Finansit Pro\FinPro.exe" ... /dbpath="\\SRV\FinDat\gold2025\" /run="SAL\FDSALREP.exe" /params="* 891"`

2. Ensure the ERP output is saved/named **`rep891gold.xls`** on `\\srv\office\Biz-Dev\Data\` and copied to the Drive folder the sync uses.

3. (Optional legacy JSON) Extend `Module1.bas` + `ExportDashboardData.bas` with `rep891gold` — done in repo alongside this doc.

4. Re-run sync and hard-refresh the dashboard.

**Fast path after updating `Z:\Biz-Dev\Data\rep891gold.xls`:** full hourly sync reads Google Drive first; the share file can be newer. Run:

`Mobile App for salesteam\sync\run_sync.bat` with `--only-gold-891`, or let the hourly job run — full sync now also loads local `rep891gold.xls` from `LOCAL_ERP_DATA_DIR` (default `Z:\Biz-Dev\Data`) after Drive files.

## Goldbug stock (no 000gold)

Goldbug has **no WMS**. The beta app maps **Pupik `000pupik`** SKUs whose prefix is **QPL** or **SCR** into virtual Goldbug warehouse stock (`src/lib/goldPupikWms.ts`). Extend `GOLD_PUPIK_WMS_PREFIXES` as you add brands.
