-- Supplier-prefix mapping: SKU prefix (text before the first '-') -> supplier name.
-- Company-agnostic; the sales RPC joins it to show real supplier names instead of
-- the bare SKU prefix. Seeded collaboratively 2026-08-10 (covers ~99% of rep891
-- sales rows / ~98% of sales value). New prefixes are added over time.
create table if not exists public.supplier_prefix (
  prefix        text primary key,
  supplier_name text not null,
  updated_at    timestamptz not null default now()
);
alter table public.supplier_prefix enable row level security;
drop policy if exists supplier_prefix_select on public.supplier_prefix;
create policy supplier_prefix_select on public.supplier_prefix
  for select using (auth.role() = 'authenticated');

insert into public.supplier_prefix (prefix, supplier_name) values
('FNK','Funko'),('PEJ','Peg Juv'),('BAN','Bandai'),('PRM','Pyramid'),('DFZ','Difuzed'),
('QPL','Qplay'),('SUP','Local Sup'),('VTH','Vtech ELP'),('LGF','LoungeFly'),('ESK','Eskimos'),
('DRB','Dreambaby'),('BBZ','Balibazoo'),('JGL','Jiangmen'),('BBK','BBK'),('MFT','Mcfarlane'),
('DBD','Dabada'),('RZR','Razor'),('CYS','CYS'),('NBC','Noble collection'),('GRB','Goldbug'),
('IRNS','Iron Studio'),('PTS','PT Sinar'),('RSK','Raskullz'),('BUZAW','Buzzbee'),('BUZ','Buzzbee'),
('STR','Local Sup'),('PEJ15','Peg Juv'),('HPS','HappyStar'),('DRG','Dreambaby'),('MARKET','marketing'),
('NEC','Neca'),('GRP','GrowPro'),('PET','Peg Toys'),('FFK','FunForKids'),('PEJO','Peg Juv'),
('KRS','Krash'),('CAR','Pupik'),('FFG','Fantasy Flight Games'),('PEJ13','Peg Juv'),('PEJ12','Peg Juv'),
('PEGAC','Peg Juv'),('CTS','CTS'),('HPL','HappyLine'),('PLD','Paladone'),('VTHH','Vtech ELP'),
('PST','Paintsation'),('EZL','EzLife'),('IMP','Pupik'),('ASD','Asmodee'),('KNT','Kent'),
('WTR','Waterfun'),('KOP','Kopplow'),('PSI','PSI'),('RZE','Razor'),('DK','Diklit'),
('PEJ14','Peg Juv'),('MTP','Monkeytime'),('VPR','Razor'),('HPR','HyPro'),('OFN','Ofanaim'),
('CHF','Chilafish'),('3DM','3DM'),('LPF','LeapFrog'),('PIN','Funko'),('PMI','PMI'),
('VTHM','Vtech COM'),('DIY','Funforkids'),('RZJ','Razor'),('LPFE','LeapFrog'),('KNR','Kick N Roll'),
('WTA','WTA'),('LPZ','Laser Pegs'),('XYT','XYT'),('LPFH','LeapFrog'),('WLD','Welldone'),
('LPB','Laser Pegs'),('WOTC','WOTC'),('MRT12','Peg Juv'),('DRBH','Dreambaby'),('APL','Apollo'),
('HBC','HBC'),('LPM','Laser Pegs'),('MOS','Moskovitch'),('YRD','Yarden'),('LPNG','Laser Pegs'),
('SMBD','Simba Dickie'),('POP','Funko'),('SJG','Steve Jackson'),('KDT','KDT'),('VTHR','Vtech ELP'),
('VTHA','Vtech ELP'),('TTG','TTG'),('DX','DX'),('LPFA','LeapFrog'),
('SPR','Pupik'),
('DHL','Shipping'),('COB','Shipping'),('SWL','Shipping'),('ISL','Shipping'),('OCL','Shipping'),
('ORN','Shipping'),('BER','Shipping'),('ALL','Shipping'),('ALC','Shipping'),('SCH','Shipping'),
('FED','Shipping'),('FEDX','Shipping'),('BAC','Shipping'),('EGP','Shipping'),
('MTS','MTS'),('SCR','Scoot & Ride'),('BST','BST'),('KIL','KIL'),('LTC','LTC'),
('PEJ11','Peg Juv'),('LPP','Laser Pegs'),('LPC','Laser Pegs'),('LPW','Laser Pegs'),
('FLX','Fluxx'),('PATH','Pathfinder'),('PUP','Pupik'),
('ZZ1','Pupik'),('ZZ2','Pupik'),('ZZ3','Pupik'),('ZZ4','Pupik'),('ZZ5','Pupik'),('ZZ9','Pupik'),
('ZZZ','Pupik'),('ZZZX','Pupik'),('ZZZZ','Pupik')
on conflict (prefix) do update set supplier_name=excluded.supplier_name, updated_at=now();
