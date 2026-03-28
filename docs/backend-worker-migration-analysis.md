# Backend Worker Migration Analysis

## Current state

The current backend in `/backend` is a Node.js + Express service that talks directly to Supabase.

Key entrypoints:

* `/Users/yun/lindong/backend/server.js`
* `/Users/yun/lindong/backend/app.js`

Core characteristics:

* Express app + `app.listen()`
* Middleware based auth (`req`, `res`, `next`)
* Route modules built with `express.Router()`
* Direct `process.env` reads
* Periodic lifecycle sync via `setInterval()`

## Why the current backend does not deploy cleanly to Workers

The current codebase is tightly coupled to the Node/Express request model.

Observed blockers:

* `express` / `body-parser` dependency chain fails validation in Cloudflare Workers
* Middleware relies on `req`, `res`, `next`
* Routes are structured as `express.Router()` trees, not fetch-style handlers
* `setInterval()` background job logic does not fit the Worker lifecycle

During deployment attempts, the Worker runtime failed inside the Express dependency chain (`body-parser` / `raw-body` / `iconv-lite`).

## Recommended target stack

Use:

* Hono as the HTTP framework
* Cloudflare Workers as the runtime
* Supabase JS as the data client
* JWT for user/admin auth
* Cron Triggers for lifecycle sync

Why Hono:

* Native Cloudflare Workers support
* Request/response model matches Workers
* Good middleware composition
* Easy route grouping for `/api/admin`, `/api/auth`, `/api/courses`, etc.

## Migration strategy

### 1. Keep business logic, replace transport layer

Do not rewrite business rules first.

Instead:

* Extract reusable business helpers from route files where needed
* Replace Express route registration with Hono route registration
* Replace Express middleware with Hono middleware

### 2. Replace background interval with Cron Trigger

Current:

* `setInterval()` in `/Users/yun/lindong/backend/server.js`

Target:

* Worker `scheduled()` handler
* Optional protected internal HTTP endpoint for manual triggering

### 3. Migrate routes in priority order

Suggested order:

1. `health`
2. `/api/auth`
3. `/api/courses`
4. `/api/groups`
5. `/api/orders`
6. `/api/payments`
7. `/api/user`
8. `/api/admin/*`
9. `/api/internal`

This order gets mini program read flows working first, then write flows, then admin.

## Route inventory by size

Large modules:

* `/Users/yun/lindong/backend/routes/admin/courses.js` - 552 lines
* `/Users/yun/lindong/backend/routes/courses.js` - 551 lines
* `/Users/yun/lindong/backend/routes/admin/groups.js` - 510 lines
* `/Users/yun/lindong/backend/utils/adminStore.js` - 465 lines
* `/Users/yun/lindong/backend/routes/admin/orders.js` - 389 lines

This suggests the migration should not be framed as a one-file switch. It is a transport-layer migration with incremental route rewrites.

## Main refactor points

### Auth middleware

Current auth files:

* `/Users/yun/lindong/backend/middleware/auth.js`
* `/Users/yun/lindong/backend/middleware/adminAuth.js`

Target:

* Hono middleware that writes `userId` / `admin` into request context variables

### Response helpers

Current helper file:

* `/Users/yun/lindong/backend/routes/admin/_helpers.js`

This can mostly be preserved by rewriting `ok()` and `fail()` helpers to return `Response` objects or Hono JSON responses.

### Request access

Current code uses:

* `req.query`
* `req.body`
* `req.params`
* `req.headers`

Target:

* `c.req.query()`
* `await c.req.json()`
* `c.req.param()`
* `c.req.header()`

### Environment variables

Current code uses `process.env`.

In Workers, use environment bindings. A compatibility layer can temporarily keep `process.env`, but the cleaner direction is:

* read from `c.env`
* pass env into helpers that need secrets or config

## Target app layout

Suggested new structure:

* `/Users/yun/lindong/backend/src/worker/app.js`
* `/Users/yun/lindong/backend/src/worker/middleware/*.js`
* `/Users/yun/lindong/backend/src/worker/routes/*.js`
* `/Users/yun/lindong/backend/src/worker/routes/admin/*.js`
* `/Users/yun/lindong/backend/src/shared/*.js`

Principles:

* `src/shared` holds reusable business helpers
* `src/worker/routes` holds Hono route definitions only
* old Express routes remain temporarily as reference until migration completes

## Recommended implementation phases

### Phase 1

* Add Hono
* Create Worker-native app entry
* Implement `/health`
* Implement Worker-native auth middleware

### Phase 2

* Migrate mini program routes:
  * `/api/auth`
  * `/api/courses`
  * `/api/groups`
  * `/api/orders`
  * `/api/payments`
  * `/api/user`

### Phase 3

* Migrate admin routes
* Migrate upload signing
* Migrate internal sync endpoint

### Phase 4

* Remove Express entrypoints
* Keep a local Worker dev workflow only
* Add cron trigger config

## Key risks

* Large route files hide business logic and HTTP transport logic together
* Admin modules are the heaviest migration surface
* Some helper modules still assume Node crypto behavior and should be tested under Workers
* Supabase calls are portable, but request/response handling around them is not

## Recommendation

Proceed with a staged migration to:

* Hono + Cloudflare Workers

Do not try to force the current Express app to run unmodified in Workers.
