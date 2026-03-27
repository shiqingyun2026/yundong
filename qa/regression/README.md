# Lindong Regression

This workspace keeps Playwright-based regression assets for the current repository.

## What is covered now

- `tests/frontend.spec.ts`: user-facing course list to course detail smoke flow
- `tests/console.spec.ts`: admin dashboard smoke flow, course create/edit/offline, account create/edit/delete, and order manual refund flow

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

## Why this lives in the repo

The global Codex Playwright MCP makes browser automation available across all projects.
These files are the project-specific layer: routes, selectors, mocks, screenshots, and future regression flows.
