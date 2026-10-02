-- ============================================================================
-- PHASE 2.6 -- transcribe today's REAL module catalog into app_node.
--
-- Nothing invented: ids, labels, routes and component names are copied
-- verbatim from the 4 places they're duplicated today (types/dashboard.ts
-- DashboardModuleId, modules/registry.ts MODULE_REGISTRY, App.tsx routes,
-- lib/oversiteModules.ts OVERSITE_MODULE_REGISTRY, pages/OversitePage.tsx).
-- Still shadow mode: app_node/app_node_edge are read by nothing live yet
-- (that's Phase 5). This just gives the future class/permission checkbox
-- tool something real to list.
--
-- Dataset-level nodes are deliberately NOT added here -- the RPCs haven't
-- been decomposed into named datasets yet (that's Phase 3+). Adding fake
-- dataset rows now would be inventing structure the code doesn't have.
-- ============================================================================

-- --- Page-level views (from MODULE_REGISTRY / App.tsx routes) --------------
insert into app_node (id, kind, label, route, sort_order) values
  ('view.oversite',          'view', 'Oversite',      '/oversite',      0),
  ('view.sales_performance', 'view', 'Sales',         '/sales',         1),
  ('view.orders_mtd',        'view', 'Orders MTD',    '/orders',        2),
  ('view.open_orders',       'view', 'Open Orders',   '/open-orders',   3),
  ('view.returns',           'view', 'Returns',       '/returns',       4),
  ('view.debt',              'view', 'Debt',          '/debt',          5),
  ('view.stock_alerts',      'view', 'Stock Alerts',  '/stock-alerts',  6),
  ('view.stock',             'view', 'Stock',         '/stock',         7),
  ('view.export',            'view', 'Export',        '/export',        8)
on conflict (id) do update set label = excluded.label, route = excluded.route, sort_order = excluded.sort_order;

-- --- Oversight sub-section widgets (from OVERSITE_MODULE_REGISTRY) --------
-- component = 'OversiteSection' for the 9 that render through the shared
-- generic wrapper (data-driven, not distinct component files); stockAlerts
-- is the one genuine standalone component today.
insert into app_node (id, kind, label, component, sort_order) values
  ('widget.ordersToday', 'widget', 'Orders Today',   'OversiteSection',  0),
  ('widget.ordersMtd',   'widget', 'Orders MTD',     'OversiteSection',  1),
  ('widget.openOrders',  'widget', 'Open Orders',    'OversiteSection',  2),
  ('widget.salesMtd',    'widget', 'Sales MTD',      'OversiteSection',  3),
  ('widget.topItems',    'widget', 'Top 10 Items',   'OversiteSection',  4),
  ('widget.suppliers',   'widget', 'Suppliers',      'OversiteSection',  5),
  ('widget.returns',     'widget', 'Returns MTD',    'OversiteSection',  6),
  ('widget.debt',        'widget', 'Open Debt',      'OversiteSection',  7),
  ('widget.receipts',    'widget', 'Receipts',       'OversiteSection',  8),
  ('widget.stockAlerts', 'widget', 'Stock Alerts',   'StockAlertsPanel', 9)
on conflict (id) do update set label = excluded.label, component = excluded.component, sort_order = excluded.sort_order;

-- --- Composition: every Oversight widget belongs to the Oversite view -----
insert into app_node_edge (parent_id, child_id, sort_order)
select 'view.oversite', id, sort_order from app_node where kind = 'widget'
on conflict (parent_id, child_id) do update set sort_order = excluded.sort_order;
