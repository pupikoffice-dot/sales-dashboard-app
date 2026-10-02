# ERP File Column Mapping Reference

All file types exported from the ERP system (Priority) and synced to Supabase.
Use this document when building parsers, sync scripts, or AI context for any app in this project group.

---

## Universal Rules

- **Client # is consistent across all files** — `acc101` col A = `891` col C = `collect008` col B = `721` col E = `debt` col B. Always the same ERP client number.
- **Item # is consistent across all files** — `891` col H = `624` col B = `000` col A = `item103` col A = `rep907` col A.
- **Supplier prefix** — first 4 characters of item ID indicate supplier and language variant. e.g. `VTHH` = Vtech Hebrew, `VTHR` = Vtech Russian, `VTHA` = Vtech Arabic. Always exactly 4 chars.
- **VAT:** collect008 col H and debt cols D–J are **VAT-inclusive (divide by 1.18 for net)**. All other cash columns are **VAT-exclusive** unless noted.
- **Filename without year** = current year data. **Filename with year suffix** = that specific year (e.g. `rep891mt2025`, `624mt2024`).
- **Row 2 in debt files** = report error, disregard.

---

## File Types

### 1. `acc101` — Client Master
**Filenames:** `acc101pupik`, `acc101mt`, `acc101grow`, `acc101gold` (`.xls`/`.xlsx`)
**Target table:** `clients`
**Structure:** Row 1 = Hebrew headers, data from row 2. One row per client.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Client # | `erp_client_id` |
| B | Client name | `name` |
| C | — | ignored |
| D | Agent # (matches `user_profiles.agent_erp_id`) | `agent_code` |
| E | — | ignored |
| F | Address | `address` |
| G | City | `city` |
| H | Phone | `phone` |
| I | Fax | `fax` |

---

### 2. `891` / `rep891` — Sales Lines
**Filenames:** `rep891pupik`, `rep891mt`, `rep891grow`, `rep891gold`, with optional year suffix (`.xls`/`.xlsx`)
**Target table:** `sales_lines`
**Structure:** One row per document per item. Hebrew headers.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Document date | `line_date` |
| B | Agent # | `agent_erp_id` |
| C | Client # | `client_id` |
| D | Client name | `client_name` |
| E | — | ignored |
| F | Document kind (11–19 = invoice, 20–29 = delivery note) | `doc_type` |
| G | Document # | `doc_num` |
| H | Item # / SKU | `item_sku` |
| I | Item barcode | `barcode` |
| J | Qty per inner carton | `inner_carton_qty` |
| K | Item name | `item_name` |
| L | Qty in document | `qty` |
| M | Gross total per row (ILS, before discount) | ignored |
| N | Discount % | `discount_pct` |
| O | Discount cash amount | `discount_cash` |
| P | **Net total per row (ILS, after discount)** | `cash` |
| Q | — | ignored |

**VAT:** All amounts are VAT-exclusive.

---

### 3. `collect008` — Collections / Payment Receipts
**Filenames:** `collect008pupik`, `collect008mt`, etc., with optional year suffix (`.xls`/`.xlsx`)
**Target table:** `client_payment_receipts`
**Structure:** One row per receipt. Hebrew headers.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Agent # | `agent_erp_id` |
| B | Client # | `erp_client_id` |
| C | Client name | `client_name` |
| D | — | ignored |
| E | Receipt document # | `receipt_num` |
| F | Receipt issued date | `receipt_issued_date` |
| G | Payment due date | `payment_due_date` |
| H | Receipt amount | `amount_paid` |
| I | City | `city` |

**VAT:** Column H is **VAT-inclusive — divide by 1.18 for net amount.**

---

### 4. `debt` — Open Debt / Aging
**Filenames:** `debtpupik`, `debtmt`, etc. (`.xls`/`.xlsx`)
**Target table:** `client_debt_lines`
**Structure:** One row per client, columns D–J are monthly aging buckets. Header row contains Hebrew month+year (e.g. "25 אוק" = Oct 2025). Column E = current month, shifts forward each month. Parser pivots to long format: one row per client per bucket month. Row 2 = report error, skip.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Agent # | `agent_erp_id` |
| B | Client # | `erp_client_id` |
| C | Client name | `client_name` |
| D | Amount for month prior to col E | `amount` (bucket = E month − 1) |
| E | Amount for current month (date in header) | `amount` (bucket from header) |
| F–J | Amount for each subsequent month (date in header) | `amount` (bucket from header) |
| K | — | ignored |

**VAT:** All amounts are **VAT-inclusive — divide by 1.18 for net.**

---

### 5. `721` — Open Orders
**Filenames:** `721pupik`, `721mt`, etc. (`.xls`/`.xlsx`)
**Target table:** `sales_lines` (doc_type = open_order)
**Structure:** One row per order line. Hebrew headers.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Document date | `line_date` |
| B | Agent # | `agent_erp_id` |
| C | — | ignored |
| D | — | ignored |
| E | Client # | `client_id` |
| F | Client name | `client_name` |
| G | — | ignored |
| H | City | `city` |
| I | Document ref — format `D{type}{number}` e.g. `D36075267` → type=`D36`, doc#=`075267` | `doc_type` + `doc_num` |
| J | — | ignored |
| K | Item # / SKU | `item_sku` |
| L | Supplier # | ignored (for now) |
| M | Item name | `item_name` |
| N | — | ignored |
| O | — | ignored |
| P | Qty open to supply | `qty` |
| Q | — | ignored |
| R | Item pricelist price | `list_price` |
| S | — | ignored |
| T | Total cash per row | `cash` |
| U+ | — | ignored |

**VAT:** Column T is VAT-exclusive.
**Document ID parsing:** Split col I on pattern `D(\d{2})(\d+)` → `doc_type` = `D` + first 2 digits, `doc_num` = remainder.

---

### 6. `624` — Inbound Stock by Month
**Filenames:** `624pupik`, `624mt`, with optional year suffix (`.xls`/`.xlsx`)
**Target table:** `stock_inbound` (pivoted)
**Structure:** One row per item, columns E–P are 12 monthly buckets. Header row contains Hebrew month names. Parser pivots to long format: one row per item per month.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Supplier # | ignored (for now) |
| B | Item # / SKU | `sku` |
| C | Item name | `name` |
| D | — | ignored |
| E–P | Total cash value of stock received that month (header = Hebrew month) | `amount` (pivoted by month) |
| Q | — | ignored |
| R | Item ID prefix (4 chars) — supplier + language code | `supplier_prefix` |

**Supplier prefix examples:** `VTHH`=Vtech Hebrew, `VTHR`=Vtech Russian, `VTHA`=Vtech Arabic, `VTHH`=Vtech Hebrew.

---

### 7. `000mt` / `000pupik` — WMS Current Stock Snapshot
**Filenames:** `000mt`, `000pupik` (`.xls`/`.xlsx`)
**Target table:** `inventory`
**Structure:** Snapshot at time of export. One row per SKU. Sync overwrites previous values.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Item # / SKU | `sku` |
| B | Available stock (qty on hand) | `qty_on_hand` |
| C | Item name | `name` |
| D | — | ignored |

**Derived:** Supplier prefix = first 4 chars of col A.

---

### 8. `item103` — Item Catalog / Categories
**Filenames:** `item103pupik`, `item103mt`, etc. (`.xls`/`.xlsx`)
**Target table:** `item_catalog`
**Structure:** One row per SKU.

| Col | Description | DB field |
|-----|-------------|----------|
| A | Item # / SKU | `sku` |
| B–F | — | ignored |
| G | Item group category | `group_cat` |
| H | — | ignored |
| I | Item tablet category (used by agents on tablet ordering app) | `tablet_cat` |
| J–L | — | ignored |

**Note:** `tablet_cat` and `group_cat` belong to this file, NOT to the 891 sales file.

---

### 9. `rep907` — Price List
**Filenames:** `rep907pupik`, `rep907mt`, etc. (`.xls`/`.xlsx`)
**Target tables:** `item_pricing` (agents), `item_pricing_admin` (admins only)
**Structure:** One row per SKU.

| Col | Description | DB field | Visibility |
|-----|-------------|----------|------------|
| A | Item # / SKU | `sku` | all |
| B | — | ignored | — |
| C | Item name | `name` | all |
| D | Supplier # | `supplier_id` | all |
| E | Landed cost / P09 | `cost` | **admin only** |
| F | Customer regular pricelist / P01 | `list_price` | all |
| G–K | — | ignored | — |
| L | Item barcode | `barcode` | all |

**VAT:** Column F is VAT-exclusive.
**Security:** Column E (cost/P09) must never be exposed to agents. Store in a separate table with RLS `role IN ('admin', 'super_admin')` only.

---

### 10. `890` / `acc004` — Ignored
Used for other internal reports outside this system. Never sync.

---

## Document Type Reference (col F in 891)

| Range | Type |
|-------|------|
| 11–19 | Invoice |
| 20–29 | Delivery note |
| D36 | Open order (721 files) |

---

## What Still Needs Mapping

- `720` files (open deliveries) — deferred, not suitable for now.
- Supplier master — supplier # appears in 624/rep907 but no supplier name file mapped yet.
