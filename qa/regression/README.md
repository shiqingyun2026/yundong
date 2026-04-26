# Lindong Regression

This directory is the automation-test workspace for the repository. It currently focuses on Playwright-based Web regression for the user-facing `frontend` and the admin `console`, and it is used together with backend Node tests and project build checks to form the current automation baseline.

## Purpose

This document explains:

- what the current automation suite includes
- which commands to run in different environments
- what is covered and what is not yet covered
- what prerequisites are needed for local, live, and production verification

## Automation Scope

The current repository automation is split into three layers.

### 1. Local Playwright regression

Run from `/Users/yun/lindong/qa/regression` with `npm test`.

Current coverage:

- `tests/frontend.spec.ts`
  - user-facing course list renders
  - course detail page can be opened from the list
- `tests/console.spec.ts`
  - admin dashboard overview renders after mocked sign-in
  - package create flow
  - package edit flow
  - package-group link from package detail
  - package-order link from package detail
  - account create, edit, delete
  - package-order manual refund flow

Characteristics:

- uses local Vite dev servers
- uses mocked admin API responses for deterministic page regression
- suitable for fast UI regression after console/frontend changes

### 1.5. Miniapp logic regression

Run from `/Users/yun/lindong/qa/regression` with `npm run test:miniprogram`.

Current coverage:

- `tests/miniprogram/package.utils.test.cjs`
  - package price calculation
  - location text normalization
  - package detail and package-group detail normalization
- `tests/miniprogram/course.detail.page.test.cjs`
  - course detail login gate for start/join actions
  - authenticated join-group navigation
- `tests/miniprogram/payment.confirm.page.test.cjs`
  - join-group form validation
  - payment amount display
  - canceled payment rollback and redirect
  - mock payment success redirect
- `tests/miniprogram/group.list.page.test.cjs`
  - tab-based filtering
  - pagination append on reach-bottom
- `tests/miniprogram/group.detail.page.test.cjs`
  - payment-success entry state presentation
  - subscription success flow

Characteristics:

- runs with `node:test`, no simulator dependency
- exercises real miniapp page methods and shared business helpers
- focuses on stable regression of core order, group, and revisit flows

### 2. Console live smoke

Run from `/Users/yun/lindong/qa/regression` with `npm run test:console-live`.

Current coverage:

- standalone `console-api` real login
- package dashboard
- package list
- package groups
- package orders and order detail
- accounts
- logs
- list filters
- rollback-safe account status update
- rollback-safe package update and log verification

Characteristics:

- starts standalone `console-api` on `http://127.0.0.1:8100`
- starts console frontend on `http://127.0.0.1:3101`
- uses real backend routes, not mocked page data
- depends on seeded regression data

### 3. Production read-only smoke

Run from `/Users/yun/lindong/qa/regression` with `npm run test:console-prod`.

Current coverage target:

- production login
- package dashboard
- package list
- package detail
- package groups
- package orders
- logs

Characteristics:

- intentionally read-only
- does not create, edit, refund, or offline data
- used to confirm the deployed console and deployed admin API are wired correctly
- requires production credentials and a reachable production `console-api`

## How To Run

### Local regression

Run from `/Users/yun/lindong/qa/regression`:

```bash
npm install
npx playwright install chromium
npm test
```

Miniapp logic regression:

```bash
npm run test:miniprogram
```

Full local regression:

```bash
npm run test:all
```

Headed mode:

```bash
npm run test:headed
```

### Standalone live smoke

```bash
npm run test:console-live
```

### Production read-only smoke

```bash
CONSOLE_PROD_BASE_URL=https://lindong-console.pages.dev \
CONSOLE_PROD_USERNAME=admin \
CONSOLE_PROD_PASSWORD='***' \
npm run test:console-prod
```

Optional production env vars:

- `CONSOLE_PROD_COURSE_KEYWORD`, default `课包`
- `CONSOLE_PROD_COURSE_CATEGORY`, default `体适能`

For the current CloudBase deployment, a custom or provided production base URL may be needed, for example:

```bash
CONSOLE_PROD_BASE_URL='https://tttiyubao-4g141829bdf6a28d-1304042243.tcloudbaseapp.com/lindong_console/' \
CONSOLE_PROD_USERNAME=admin \
CONSOLE_PROD_PASSWORD='***' \
npm run test:console-prod
```

## Seeded Assumptions For Live Smoke

The live smoke currently assumes fixed seeded business data.

- package: `[课包回归] 进行中少儿体适能 5 次课`
- active package id: `package_seed_active_002`
- success package id: `package_seed_success_003`
- refunded package order: `LDPKG20260419007`
- account: `admin`
- super admin account: `admin`

If these records are missing or polluted, live smoke assertions will fail even if the page code itself is correct.

## Current Baseline

Latest verified local baseline on 2026-04-22:

- local Playwright regression: `6 passed`
- backend Node tests: `66 passed`
- backend `verify:console-api-smoke`: `9 passed`
- `frontend` lint/build: passed
- `console` lint/build: passed

Expanded local baseline target from 2026-04-24:

- miniapp logic regression: package utils, course detail, payment confirm, my group list, group detail
- local Playwright regression: `frontend` + `console`

Production verification status on 2026-04-22:

- production console page can be opened and login page can be reached
- production login currently does not complete because the deployed `console-api` login endpoint returns `503 Service Unavailable`

## What Is Not Covered Yet

The current automation is useful, but it is not full coverage of all critical business functionality.

Not fully covered yet:

- WeChat miniprogram real device / simulator end-to-end flows
- real payment, group join, and post-payment user-side state transitions
- banner management regression
- package offline flow regression
- image upload and rich-text image insertion regression
- geocode and location suggestion success-path regression
- broader failure-state regression such as timeout, partial API failure, and empty-state handling
- systematic production regression beyond read-only smoke

## Security Coverage Status

This workspace is not a dedicated security-audit suite.

Some security-related behavior is indirectly covered:

- missing-token rejection
- admin and super-admin authorization boundaries
- trusted CloudBase identity header handling
- basic protected-route behavior

Not yet included as a formal automation/security audit:

- dependency vulnerability scanning
- secret/config exposure checks
- injection-oriented review
- CSRF/CORS/upload abuse review
- production deployment hardening review

## Recommended Use

Use this sequence when validating a release or major change:

1. Run backend tests in `/Users/yun/lindong/backend`
2. Run `frontend` and `console` lint/build checks
3. Run local Playwright regression in `/Users/yun/lindong/qa/regression`
4. If backend seed data is ready, run `npm run test:console-live`
5. If production credentials and production API are healthy, run `npm run test:console-prod`

## Why This Lives Here

The global Codex Playwright tooling provides browser automation capability, but this folder is the project-specific automation layer:

- routes
- selectors
- environment assumptions
- mock payloads
- seeded data contracts
- production smoke entrypoints
