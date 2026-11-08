"""Rebuild public.item_category_codes from item103*/item104*.xls (pairs by SKU). Output: seed.sql next to this script run dir.
Run with the sync python (needs xlrd from sync/_vendor); apply seed.sql with: supabase db query --remote=<ref> --file seed.sql"""
import sys, io, collections
B = r'Z:\Biz-Dev\Projects\Codding\Management Dashboard\beta\sync'
sys.path.insert(0, B + r'\_vendor')
import xlrd
D = '//srv/office/Biz-Dev/Data/'
def s(v):
    if isinstance(v, float) and v == int(v): v = int(v)
    return str(v).strip()
def load(n):
    sh = xlrd.open_workbook(D + n).sheet_by_index(0)
    return {s(sh.cell_value(r,0)): [s(x) for x in sh.row_values(r)] for r in range(1, sh.nrows)}
q = lambda x: "'" + x.replace("'", "''") + "'"
rows = []
for co, f3, f4 in [('mt','item103mt.xls','item104mt.xls'), ('pupik','item103pupik.xls','item104pupik.xls')]:
    d3, d4 = load(f3), load(f4)
    for lvl in range(1, 11):
        txt = collections.defaultdict(collections.Counter); cnt = collections.Counter()
        for k in d3:
            if k not in d4: continue
            t = d3[k][lvl+1]; n = d4[k][lvl]
            if not n: continue
            cnt[n] += 1
            if t: txt[n][t] += 1
        for n, c in cnt.items():
            d = txt[n].most_common(1)[0][0] if txt[n] else None
            rows.append(f"({q(co)},{lvl},{q(n)},{q(d) if d else 'null'},{c})")
sql = ("insert into public.item_category_codes(company, level, code, description, items) values\n" + ",\n".join(rows) +
       "\non conflict (company, level, code) do update set description = excluded.description, items = excluded.items, updated_at = now();\n")
open('seed.sql', 'w', encoding='utf-8').write(sql)
print(len(rows), 'rows')
