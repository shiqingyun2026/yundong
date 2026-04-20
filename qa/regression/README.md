# Lindong Regression

This workspace keeps Playwright-based regression assets for the current repository.

## What is covered now

- `tests/frontend.spec.ts`: user-facing course list to course detail smoke flow
- `tests/console.spec.ts`: admin dashboard smoke flow, package create/edit, package-group list, package-order manual refund, and account create/edit/delete flow
- `tests/console.live.spec.ts`: standalone `console-api` + console frontend real login, package dashboard, packages, package groups, package orders, accounts, logs, filter, rollback-safe account update, and rollback-safe package update/log smoke
- `tests/console.prod.spec.ts`: production Pages site read-only smoke for login, package dashboard, package list, package detail, package groups, package orders, and logs

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

Production console read-only smoke:

```bash
CONSOLE_PROD_BASE_URL=https://lindong-console.pages.dev \
CONSOLE_PROD_USERNAME=admin \
CONSOLE_PROD_PASSWORD='***' \
npm run test:console-prod
```

Optional production smoke env vars:

- `CONSOLE_PROD_COURSE_KEYWORD` defaults to `南山`
- `CONSOLE_PROD_COURSE_CATEGORY` defaults to `体适能`

This command starts:

- standalone `console-api` on `http://127.0.0.1:8100`
- console frontend on `http://127.0.0.1:3101`

and verifies real login plus package dashboard, package list, package-group list, package-order detail, accounts, logs, list filters, a rollback-safe account status update with `account_update` log verification, and a rollback-safe package update against the standalone admin service.

The production smoke does not create, edit, refund, or offline any data. It is intentionally read-only and only verifies that the deployed console and admin API are wired correctly.

Current seeded assumptions used by the live smoke:

- package: `[课包回归] 进行中少儿体适能 5 次课`
- active package id: `package_seed_active_002`
- success package id: `package_seed_success_003`
- refunded package order: `LDPKG20260419007`
- account: `admin`
- super admin account: `admin`

Latest local result on 2026-03-29: passed.

## Why this lives in the repo

The global Codex Playwright MCP makes browser automation available across all projects.
These files are the project-specific layer: routes, selectors, mocks, screenshots, and future regression flows.
