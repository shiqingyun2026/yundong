# Lindong Regression

This workspace keeps Playwright-based regression assets for the current repository.

## What is covered now

- `tests/frontend.spec.ts`: user-facing course list to course detail smoke flow
- `tests/console.spec.ts`: admin dashboard smoke flow, course create/edit/offline, account create/edit/delete, and order manual refund flow
- `tests/console.live.spec.ts`: standalone `console-api` + console frontend real login, dashboard, courses, orders, accounts, logs, filter, rollback-safe account update, and rollback-safe course update/log smoke

## Commands

Run from `/Users/yun/lindong/qa/regression`:

```bash
npm install
npx playwright install chromium
npm test
```

Headed mode:

```bash
npm run test:headed
```

Standalone console real integration smoke:

```bash
npm run test:console-live
```

This command starts:

- standalone `console-api` on `http://127.0.0.1:8100`
- console frontend on `http://127.0.0.1:3101`

and verifies real login plus dashboard, courses, orders, accounts, logs, list filters, a rollback-safe account status update with `account_update` log verification, and a rollback-safe pending-course update against the standalone admin service.

Current seeded assumptions used by the live smoke:

- course: `[测试] 深圳南山周末体适能·待上架`
- pending course id: `11111111-1111-1111-1111-111111111101`
- refunded order: `LD202603260007`
- account: `t1`
- super admin account: `admin`

Latest local result on 2026-03-29: passed.

## Why this lives in the repo

The global Codex Playwright MCP makes browser automation available across all projects.
These files are the project-specific layer: routes, selectors, mocks, screenshots, and future regression flows.
