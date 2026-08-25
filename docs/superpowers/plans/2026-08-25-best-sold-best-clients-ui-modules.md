# Best Sold + Best Clients UI Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per-user suite tiles for Best sold items / Best clients (MTD top 10) in Sales Manager suite next to BI; classic Oversight unchanged.

**Architecture:** Seed `app_ui_module` rows; `dashboard_user_ui` grants; hardcoded `SUITE_MOUNTABLE_UI_MODULE_IDS`; exclude from Classes; ignore class addon keys; mount after `BiCubesBlock`.

**Tech Stack:** React, TanStack Query, Supabase, Vitest, existing suite BI chrome.

**Spec:** `docs/superpowers/specs/2026-08-25-best-sold-best-clients-ui-modules-design.md`

**Channel:** `beta` only.

---

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260825140000_best_sold_best_clients_ui.sql` | Seed modules + `dashboard_user_ui` |
| `src/lib/suiteUiModules.ts` | Allowlist, resolve visible, class-grantable filter |
| `src/lib/suiteUiModules.test.ts` | Tests |
| `src/lib/suiteUiMetrics.ts` | MTD top10 items/clients + tests |
| `src/lib/suiteUiModulesApi.ts` | Fetch/set grants |
| `src/hooks/useSuiteUiUserGrants.ts` | Query hook |
| `src/lib/uiModules.ts` | Ignore allowlist ids in class→classic mapping |
| `src/components/admin/PermissionSections.tsx` | Exclude from Classes UI |
| `src/pages/admin/UsersPage.tsx` | Per-user checkboxes |
| `src/components/oversite/salesManager/suiteUi/*` | Table cubes |
| `src/components/oversite/salesManager/bi/BiCubesBlock.tsx` or suite shell | Mount after BI |
| `src/i18n/en.ts`, `he.ts` | Strings |

---
