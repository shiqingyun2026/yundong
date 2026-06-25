# 2026-06-25 Release Test And Security Check

## Goal

Prepare the Lindong project for release by running local regression, build, dependency, and security checks, then fixing the release-blocking issues found during verification.

## Current Status

Status: local remediation complete; production console smoke passed; local direct MySQL smoke remains environment-blocked.

This document records the release check started on 2026-06-25. It has been updated after dependency remediation, console regression fixes, CloudBase API checks, and production console smoke verification.

## Verified Passing Checks

- `backend`: `npm run services:check` passed.
- `backend`: `npm run test:package-flows` passed with 21 tests.
- `backend`: `npm run verify:course-lifecycle` passed with 6 scenarios.
- `backend`: `npm run verify:group-rules` passed with 8 scenarios.
- `backend`: `npm run verify:console-api-smoke` passed with 9 tests.
- `console`: `npm run lint` passed.
- `console`: `npm run build:cloudbase` passed.
- `qa/regression`: `npm run test:miniprogram` passed with 31 tests.
- `qa/regression`: `PW_PROJECTS=console-chromium npx playwright test --project=console-chromium --reporter=list` passed with 16 tests after remediation.
- `qa/regression`: production console smoke against `https://tiantiantiyubao.cn/console/` passed with 4 tests after production selector updates.
- `miniprogram`: `npm audit --omit=dev --audit-level=moderate` found 0 vulnerabilities.
- `backend`: `npm audit --omit=dev --audit-level=moderate` found 0 vulnerabilities after remediation.
- `console`: `npm audit --omit=dev --audit-level=moderate` found 0 vulnerabilities after remediation.

## Release Blockers

### B1: Production Dependency Vulnerabilities

Severity: resolved.

Evidence:

- `backend npm audit --omit=dev --audit-level=moderate` reported 5 vulnerabilities:
  - high: `path-to-regexp` ReDoS advisory.
  - high: `ws` memory disclosure / DoS advisories.
  - moderate: `qs`, `body-parser`, and `express` DoS advisories.
- `console npm audit --omit=dev --audit-level=moderate` reported 2 high vulnerabilities:
  - `react-router` / `react-router-dom` advisories including RCE, open redirect, DoS, and CSRF-related advisories.

Next action:

- Completed with `npm audit fix`.
- `backend/package-lock.json` now resolves production dependencies to non-vulnerable versions including `express@4.22.2`, `path-to-regexp@0.1.13`, `qs@6.15.3`, and `ws@8.21.0`.
- `console/package-lock.json` now resolves `react-router-dom@7.18.0` and `react-router@7.18.0`.
- Re-ran `npm audit --omit=dev --audit-level=moderate` in both directories; both reported 0 vulnerabilities.
- Re-ran backend smoke tests and console lint/build; all passed.

### B2: Console Mock Playwright Regression Failing

Severity: resolved.

Evidence:

- `qa/regression`: `PW_PROJECTS=console-chromium npx playwright test --project=console-chromium --reporter=list` reported 10 passed and 6 failed.

Observed root causes:

- Package form tests still use old `textarea` indexes, but the page now uses `RichTextEditor` for coach intro and package intro.
- Package create/edit tests do not populate the required `wechat_share_cover` field.
- Banner tests use 2026-04 and 2026-05 online dates. On 2026-06-25, the page correctly blocks create submissions with `上线时间必须晚于当前时间`.

Next action:

- Updated `qa/regression/tests/console.spec.ts` to interact with TipTap rich text editors by visible section heading.
- Added required WeChat share cover URL data to package create/edit test fixtures.
- Moved Banner create/copy/error test dates to 2027.
- Re-ran console Playwright project; 16 tests passed.

### B3: Local Console Live Smoke Blocked By CloudBase Internal MySQL Network

Severity: medium for local confidence, environment-network-blocked.

Evidence:

- `qa/regression`: `npm run test:console-live` reported 6 failed.
- Web server log showed `getaddrinfo ENOTFOUND mvdffytjacbtnkvtscdb.supabase.co`.
- A direct DNS check for the configured legacy Supabase host also returned `ENOTFOUND`.
- `backend/.env` currently does not enable `USE_MYSQL_REPOSITORIES` and does not define MySQL host/database values, so the live smoke is accidentally using a legacy Supabase path in this local environment.
- After receiving MySQL test credentials, `backend/.env` was switched to MySQL mode for `tiyubao-pre`.
- Direct MySQL connectivity from this environment still fails:
  - `172.17.0.3:3306`: connection timeout.
  - `127.0.0.1:3306`: connection refused.
  - `localhost:3306`: connection refused.
- `docker` is not available in the current shell, so local container port mappings could not be inspected from here.
- User confirmed the database is CloudBase MySQL. The CloudBase service VPC shown in console uses the `172.17.0.0/16` private network, which explains why `172.17.0.3:3306` is not reachable from the local Codex shell.
- CloudBase deployed console API health checks passed:
  - `/health` returned `ok: true` for `lindong-console-api`.
  - `/health/package-refund-flow` returned `ok: true` and `use_mysql_repositories: true`.

Interpretation:

- This is an environment configuration mismatch, not the intended release architecture.
- Per `AGENTS.md`, the current main chain is WeChat native miniprogram + Node.js/Express + CloudBase container identity + MySQL data layer. Supabase is not the active production data path for this release.
- The live smoke reached the real local integration layer, but the local console API was started with stale legacy database configuration. The failures are chained from login/session setup not completing.
- The deployed CloudBase console API is already running in MySQL mode. Local direct-DB smoke should not use the private CloudBase MySQL address unless the shell is inside the same VPC or a tunnel/proxy is provided.

Next action:

- For local `npm run test:console-live`, provide a host-reachable MySQL endpoint, or run the live smoke from an environment inside the CloudBase VPC.
- Ensure the seeded regression records described in `qa/regression/README.md` exist in that MySQL database.
- Re-run `npm run test:console-live` after MySQL connectivity succeeds.

### B5: Production Console Smoke Selectors Were Stale

Severity: resolved.

Evidence:

- Production custom domain is `https://tiantiantiyubao.cn/console/`.
- The production app loads its API from the same custom domain under `/api/admin`, which matches the current deployed frontend bundle.
- Initial production smoke could log in, but failed on stale selectors and labels:
  - Dashboard had both sidebar and quick-access links named `课包管理`; the assertion needed an exact sidebar link match.
  - Package search placeholder is now `按课包编号或名称搜索`.
  - Package detail uses `团型人数` under pricing instead of the older `支持人数` label.
  - Package group table header is now `拼团编号`.

Next action:

- Updated `qa/regression/tests/console.prod.spec.ts` to use current production labels and exact link matching.
- Re-ran production console smoke against `https://tiantiantiyubao.cn/console/`; 4 tests passed.

### B4: Frontend Regression Project Points To Missing Directory

Severity: medium.

Evidence:

- `qa/regression/playwright.config.ts` references `../../frontend`.
- `/Users/yun/lindong/frontend` does not exist in the current project structure.

Next action:

- Decide whether the `frontend-chromium` project is historical and should be removed/disabled, or whether a new frontend path should be configured.
- Until resolved, use `PW_PROJECTS=console-chromium` for console-only local regression.

## Security Findings To Review Before Release

- Both backend service entrypoints currently use default `express.cors()`. Before public release, production CORS should be restricted to approved origins where practical.
- `TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY` defaults to true in the miniprogram container. Production routing must ensure direct public clients cannot spoof `x-wx-openid` and related CloudBase identity headers.
- Console upload proxy has positive controls: admin authentication, allowed folders, filename sanitization, image MIME/signature checks, and max-size enforcement.
- Real `.env` files are not tracked by git. Only `.env.example` and `console/.env.production` style files are tracked.

## Manual Release Checks Still Needed

- WeChat miniprogram real device or developer-tool smoke for login, package detail, start/join group, payment cancel, and post-payment result views.
- Production CloudBase route check for console SPA fallback to `index.html`.
- Production environment variable review for `JWT_SECRET`, admin bootstrap credentials, WeChat Pay keys, mini program app secret, internal payment secret, and cron secret.

## Work Log

- 2026-06-25: Initial local verification and security scan completed.
- 2026-06-25: Remediation started for dependency vulnerabilities, console regression tests, and live smoke environment verification.
- 2026-06-25: Backend and console production dependency audits remediated to 0 vulnerabilities.
- 2026-06-25: Console mock Playwright regression updated and rerun successfully with 16 passing tests.
- 2026-06-25: Console live smoke rerun; still blocked because local `backend/.env` uses stale legacy Supabase config instead of the current MySQL test database path.
- 2026-06-25: Local `backend/.env` switched to the provided MySQL test configuration; direct MySQL connection still timed out/refused from this shell.
- 2026-06-25: CloudBase console API health checks passed and confirmed deployed API is using MySQL repositories.
- 2026-06-25: Production console smoke against `https://tiantiantiyubao.cn/console/` updated and passed with 4 tests.
