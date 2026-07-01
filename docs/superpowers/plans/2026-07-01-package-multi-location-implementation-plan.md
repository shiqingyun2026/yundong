# Package Multi-Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one course package support multiple service locations, lock a selected location onto each package group, and display/sort package groups by location distance and deadline.

**Architecture:** Add a normalized `course_package_locations` table and location snapshot fields on `package_groups`. Keep package pricing, schedule, group rules, and coach assignment at package/group level; location only describes service point. Both backend implementations expose the same location shape, while Mini Program and Console use that shape for display, selection, and management.

**Tech Stack:** MySQL, Node.js, Express, `node:test`, React 19 + TypeScript + Vite, native WeChat Mini Program WXML/WXSS/JS.

---

## Scope And Ordering

This plan implements the approved spec in small commits. Do not modify `console/dist/`. Begin and end every coding session with `git status --short`.

Recommended execution order:

1. Database and repository foundations.
2. Shared location formatting and distance helpers.
3. Mini Program API readers.
4. Package order and group snapshot write path.
5. Console API location management.
6. Console UI.
7. Mini Program UI.
8. Seed, regression, and final verification.

## File Map

Create:

- `docs/sql/package_multi_location_migration.sql`: manual MySQL migration with compatibility backfill.
- `backend/lindong-api/repositories/coursePackageLocationsRepository.js`: Mini Program API repository for package locations.
- `backend/console-api-service/repositories/coursePackageLocationsRepository.js`: Console API repository for package locations.
- `backend/console-api-service/tests/package-location-rules.test.cjs`: cross-backend tests for pure location helpers.
- `miniprogram/tests/package-location-transform.test.cjs`: Mini Program transform tests for supported locations and group location display.

Modify:

- `docs/sql/bootstrap_lindong_test_schema_compat.sql`, `docs/sql/bootstrap_lindong_test_minimal.sql`, `docs/sql/bootstrap_lindong_test_minimal_plain.sql`, `docs/sql/bootstrap_lindong_test_seed_compat.sql`: test schema and seed compatibility.
- `backend/lindong-api/repositories/index.js`, `backend/console-api-service/repositories/index.js`: export new repositories.
- `backend/lindong-api/repositories/coursePackagesRepository.js`, `backend/console-api-service/repositories/coursePackagesRepository.js`: keep old package fields, add compatibility helpers as needed.
- `backend/lindong-api/repositories/packageGroupsRepository.js`, `backend/console-api-service/repositories/packageGroupsRepository.js`: read/write `location_id` and `location_snapshot`.
- `backend/lindong-api/shared/services/packageReaders.js`, `backend/console-api-service/shared/services/packageReaders.js`: location formatting, fallback, distance, list/detail payloads.
- `backend/lindong-api/shared/services/packageOrders.js`, `backend/console-api-service/shared/services/packageOrders.js`: validate selected location and persist snapshots.
- `backend/lindong-api/routes/packages.js`, `backend/lindong-api/routes/package-orders.js`: accept detail coordinates and start-order location.
- `backend/console-api-service/console-api/services/packageAdminService.js`: create/update/list package locations and include group/order location display.
- `backend/console-api-service/console-api/routes/packages.js`: expose location payloads through existing handlers.
- `console/src/types.ts`, `console/src/pages/PackageFormPage.tsx`, `console/src/pages/PackageGroupListPage.tsx`, `console/src/pages/PackageGroupDetailPage.tsx`, `console/src/pages/PackageOrderListPage.tsx`: Console location UI and display.
- `miniprogram/utils/package.js`: normalize locations, active group location, and start order request.
- `miniprogram/pages/course/detail/index.js`, `miniprogram/pages/course/detail/index.wxml`, `miniprogram/pages/course/detail/index.wxss`: request coordinates, show supported locations and group location.
- `miniprogram/pages/package/start/index.js`, `miniprogram/pages/package/start/index.wxml`, `miniprogram/pages/package/start/index.wxss`: location selection.
- `miniprogram/pages/payment/confirm/index.js`, `miniprogram/pages/payment/confirm/index.wxml`, `miniprogram/pages/group/detail/index.js`, `miniprogram/pages/group/detail/index.wxml`: display locked group location.
- `qa/regression/` seed and tests if the existing regression data is used for package flows.

---

### Task 1: Database Migration And Test Schema

**Files:**
- Create: `docs/sql/package_multi_location_migration.sql`
- Modify: `docs/sql/bootstrap_lindong_test_schema_compat.sql`
- Modify: `docs/sql/bootstrap_lindong_test_minimal.sql`
- Modify: `docs/sql/bootstrap_lindong_test_minimal_plain.sql`
- Modify: `docs/sql/bootstrap_lindong_test_seed_compat.sql`

- [ ] **Step 1: Write the migration SQL**

Create `docs/sql/package_multi_location_migration.sql` with this structure:

```sql
USE `tiyubao-pre`;

CREATE TABLE IF NOT EXISTS `course_package_locations` (
  `id` varchar(64) NOT NULL,
  `package_id` varchar(64) NOT NULL,
  `location_district` varchar(255) NOT NULL DEFAULT '',
  `location_community` varchar(255) NOT NULL DEFAULT '',
  `location_detail` varchar(500) NOT NULL DEFAULT '',
  `longitude` decimal(10,6) DEFAULT NULL,
  `latitude` decimal(10,6) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `status` tinyint NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_package_locations_package_id` (`package_id`),
  KEY `idx_course_package_locations_status` (`status`),
  KEY `idx_course_package_locations_package_status` (`package_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `package_groups`
  ADD COLUMN `location_id` varchar(64) DEFAULT NULL AFTER `package_id`,
  ADD COLUMN `location_snapshot` json DEFAULT NULL AFTER `location_id`;

INSERT INTO `course_package_locations` (
  `id`, `package_id`, `location_district`, `location_community`, `location_detail`,
  `longitude`, `latitude`, `sort_order`, `status`, `created_at`, `updated_at`
)
SELECT
  CONCAT(`id`, '-loc-001'),
  `id`,
  COALESCE(`location_district`, ''),
  COALESCE(`location_community`, ''),
  COALESCE(`location_detail`, ''),
  `longitude`,
  `latitude`,
  0,
  1,
  COALESCE(`created_at`, NOW()),
  COALESCE(`updated_at`, NOW())
FROM `course_packages` p
WHERE NOT EXISTS (
  SELECT 1 FROM `course_package_locations` l WHERE l.`package_id` = p.`id`
);
```

- [ ] **Step 2: Update test schema files**

Add the same table definition and `package_groups.location_id/location_snapshot` columns to the three bootstrap schema files. Use `json DEFAULT NULL` in MySQL-compatible schema files and `text DEFAULT NULL` only in plain fallback files that already avoid MySQL-specific types.

- [ ] **Step 3: Update seed data**

In `docs/sql/bootstrap_lindong_test_seed_compat.sql`, insert at least two locations for `pkg_test_001`:

```sql
INSERT INTO `course_package_locations` (
  `id`, `package_id`, `location_district`, `location_community`, `location_detail`,
  `longitude`, `latitude`, `sort_order`, `status`, `created_at`, `updated_at`
) VALUES
  ('pkg_test_001_loc_a', 'pkg_test_001', '广东省 / 深圳市 / 南山区', '前海花园', '前海花园中心草坪', 113.900000, 22.520000, 0, 1, NOW(), NOW()),
  ('pkg_test_001_loc_b', 'pkg_test_001', '广东省 / 深圳市 / 南山区', '后海社区', '后海社区活动场', 113.940000, 22.510000, 1, 1, NOW(), NOW());
```

- [ ] **Step 4: Review SQL manually**

Run:

```bash
rg -n "course_package_locations|location_snapshot|location_id" docs/sql
```

Expected: the new migration and bootstrap schema/seed files all contain the new table and group fields.

- [ ] **Step 5: Commit**

```bash
git add docs/sql/package_multi_location_migration.sql docs/sql/bootstrap_lindong_test_schema_compat.sql docs/sql/bootstrap_lindong_test_minimal.sql docs/sql/bootstrap_lindong_test_minimal_plain.sql docs/sql/bootstrap_lindong_test_seed_compat.sql
git commit -m "feat: add package location schema"
```

---

### Task 2: Location Repositories And Shared Helpers

**Files:**
- Create: `backend/lindong-api/repositories/coursePackageLocationsRepository.js`
- Create: `backend/console-api-service/repositories/coursePackageLocationsRepository.js`
- Modify: `backend/lindong-api/repositories/index.js`
- Modify: `backend/console-api-service/repositories/index.js`
- Modify: `backend/lindong-api/repositories/packageGroupsRepository.js`
- Modify: `backend/console-api-service/repositories/packageGroupsRepository.js`
- Modify: `backend/lindong-api/shared/services/packageReaders.js`
- Modify: `backend/console-api-service/shared/services/packageReaders.js`
- Test: `backend/console-api-service/tests/package-location-rules.test.cjs`

- [ ] **Step 1: Write failing helper tests**

Create `backend/console-api-service/tests/package-location-rules.test.cjs`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..', '..')
const lindongReaders = require(path.join(root, 'backend/lindong-api/shared/services/packageReaders.js'))
const consoleReaders = require(path.join(root, 'backend/console-api-service/shared/services/packageReaders.js'))

for (const [name, readers] of [
  ['lindong-api', lindongReaders],
  ['console-api-service', consoleReaders]
]) {
  test(`${name} formats package location snapshot text`, () => {
    assert.equal(
      readers.buildPackageLocationText({
        location_district: '广东省 / 深圳市 / 南山区',
        location_community: '前海花园',
        location_detail: '中心草坪'
      }),
      '深圳市 / 南山区 / 前海花园'
    )
  })

  test(`${name} sorts locations by distance with deadline fallback`, () => {
    const sorted = readers.sortPackageGroupsByLocationDistanceAndDeadline({
      groups: [
        { id: 'late-near', deadline: '2026-07-03 10:00:00', location_snapshot: { latitude: 22.5201, longitude: 113.9001 } },
        { id: 'early-far', deadline: '2026-07-02 10:00:00', location_snapshot: { latitude: 22.9000, longitude: 113.9000 } },
        { id: 'early-near', deadline: '2026-07-02 09:00:00', location_snapshot: { latitude: 22.5201, longitude: 113.9001 } }
      ],
      latitude: 22.5200,
      longitude: 113.9000
    })

    assert.deepEqual(sorted.map(item => item.id), ['early-near', 'late-near', 'early-far'])
  })
}
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: FAIL because `buildPackageLocationText` and `sortPackageGroupsByLocationDistanceAndDeadline` are not exported yet.

- [ ] **Step 3: Implement repository modules**

Create matching repository files in both backend roots with these functions: `normalizePackageLocation`, `listLocationsByPackageId`, `listLocationsByPackageIds`, `findLocationById`, `replaceLocationsForPackage`, `hasPackageGroupsUsingLocation`.

Use this shape for normalized rows:

```js
{
  id: row.id,
  package_id: row.package_id,
  location_district: row.location_district || '',
  location_community: row.location_community || '',
  location_detail: row.location_detail || '',
  longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
  latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
  sort_order: Number(row.sort_order) || 0,
  status: Number(row.status) === 0 ? 0 : 1,
  created_at: row.created_at || null,
  updated_at: row.updated_at || null
}
```

For `replaceLocationsForPackage`, keep rows referenced by `package_groups.location_id`; update them to `status = 0` when omitted from the next payload. Insert new rows with IDs `${packageId}-loc-${String(index + 1).padStart(3, '0')}` when no ID is supplied.

- [ ] **Step 4: Export repositories**

Add `coursePackageLocationsRepository` to both `repositories/index.js` files next to `coursePackagesRepository` and `packageGroupsRepository`.

- [ ] **Step 5: Add group location fields**

In both `packageGroupsRepository.js` files, add `location_id` and `location_snapshot` to select, normalize, create, and update paths. Normalize `location_snapshot` with the existing JSON parser.

- [ ] **Step 6: Add shared helper exports**

In both `shared/services/packageReaders.js`, export:

```js
const buildPackageLocationText = location => buildMiniProgramLocationText(location || {})

const resolveGroupLocationSnapshot = ({ group = {}, pkg = {}, location = null }) => {
  if (group.location_snapshot && typeof group.location_snapshot === 'object') {
    return group.location_snapshot
  }
  if (location) {
    return {
      id: location.id || '',
      location_district: location.location_district || '',
      location_community: location.location_community || '',
      location_detail: location.location_detail || '',
      longitude: location.longitude ?? null,
      latitude: location.latitude ?? null
    }
  }
  return {
    id: '',
    location_district: pkg.location_district || '',
    location_community: pkg.location_community || '',
    location_detail: pkg.location_detail || '',
    longitude: pkg.longitude ?? null,
    latitude: pkg.latitude ?? null
  }
}

const sortPackageGroupsByLocationDistanceAndDeadline = ({ groups = [], latitude = null, longitude = null }) =>
  [...groups]
    .map(group => ({
      ...group,
      distance_meters: calculateDistanceMeters({ latitude, longitude }, group.location_snapshot || group.location || {})
    }))
    .sort((left, right) => {
      const leftDistance = Number.isFinite(left.distance_meters) ? left.distance_meters : Number.MAX_SAFE_INTEGER
      const rightDistance = Number.isFinite(right.distance_meters) ? right.distance_meters : Number.MAX_SAFE_INTEGER
      if (leftDistance !== rightDistance) return leftDistance - rightDistance
      return (parseShanghaiDate(left.deadline)?.getTime() || 0) - (parseShanghaiDate(right.deadline)?.getTime() || 0)
    })
```

- [ ] **Step 7: Run tests**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/lindong-api/repositories backend/console-api-service/repositories backend/lindong-api/shared/services/packageReaders.js backend/console-api-service/shared/services/packageReaders.js backend/console-api-service/tests/package-location-rules.test.cjs
git commit -m "feat: add package location repositories"
```

---

### Task 3: Mini Program API List And Detail Reads

**Files:**
- Modify: `backend/lindong-api/shared/services/packageReaders.js`
- Modify: `backend/lindong-api/routes/packages.js`
- Test: `backend/console-api-service/tests/package-location-rules.test.cjs`

- [ ] **Step 1: Extend tests for nearest package location**

Add this test to `backend/console-api-service/tests/package-location-rules.test.cjs` for both reader modules:

```js
test(`${name} resolves nearest package location`, () => {
  const nearest = readers.resolveNearestPackageLocation({
    locations: [
      { id: 'far', latitude: 23.0000, longitude: 113.9000 },
      { id: 'near', latitude: 22.5201, longitude: 113.9001 }
    ],
    latitude: 22.5200,
    longitude: 113.9000
  })

  assert.equal(nearest.id, 'near')
  assert.equal(Number.isFinite(nearest.distance_meters), true)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: FAIL because `resolveNearestPackageLocation` is not exported yet.

- [ ] **Step 3: Implement nearest location helper**

In both `packageReaders.js` files, add:

```js
const resolveNearestPackageLocation = ({ locations = [], latitude = null, longitude = null }) => {
  const enabledLocations = (locations || []).filter(item => Number(item.status) !== 0)
  const scored = enabledLocations.map(item => ({
    ...item,
    distance_meters: calculateDistanceMeters({ latitude, longitude }, item)
  }))

  return scored.sort((left, right) => {
    const leftDistance = Number.isFinite(left.distance_meters) ? left.distance_meters : Number.MAX_SAFE_INTEGER
    const rightDistance = Number.isFinite(right.distance_meters) ? right.distance_meters : Number.MAX_SAFE_INTEGER
    if (leftDistance !== rightDistance) return leftDistance - rightDistance
    return (Number(left.sort_order) || 0) - (Number(right.sort_order) || 0)
  })[0] || null
}
```

- [ ] **Step 4: Update `fetchMiniProgramPackageList`**

Load all locations for visible package IDs. For each package:

- Use enabled location rows.
- Compute nearest location from request `lat/lng`.
- Set `distance_meters` from nearest location.
- Continue returning `location_*` compatibility fields from the package row.
- Add `nearest_location_id` only for diagnostics.

- [ ] **Step 5: Update `fetchMiniProgramPackageDetail`**

Accept `latitude` and `longitude` parameters. Return:

```js
locations: enabledLocations.map(item => ({
  id: item.id,
  location_district: item.location_district,
  location_community: item.location_community,
  location_detail: item.location_detail,
  longitude: item.longitude,
  latitude: item.latitude,
  location_text: buildPackageLocationText(item),
  distance_meters: calculateDistanceMeters({ latitude, longitude }, item)
}))
```

For `active_groups`, resolve each group location snapshot using group snapshot, related location row, then package fallback. Sort with `sortPackageGroupsByLocationDistanceAndDeadline`.

- [ ] **Step 6: Update route query handling**

In `backend/lindong-api/routes/packages.js`, pass `Number(req.query.lat)` and `Number(req.query.lng)` to package detail reads only when both are finite.

- [ ] **Step 7: Run backend helper tests**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/lindong-api/shared/services/packageReaders.js backend/console-api-service/shared/services/packageReaders.js backend/lindong-api/routes/packages.js backend/console-api-service/tests/package-location-rules.test.cjs
git commit -m "feat: expose package locations in mini program api"
```

---

### Task 4: Order Start And Group Location Snapshots

**Files:**
- Modify: `backend/lindong-api/routes/package-orders.js`
- Modify: `backend/lindong-api/shared/services/packageOrders.js`
- Modify: `backend/console-api-service/shared/services/packageOrders.js`
- Modify: `backend/lindong-api/shared/domain/packageGroupRules.js` if group creation payload is centralized there.
- Test: `backend/console-api-service/tests/package-location-rules.test.cjs`

- [ ] **Step 1: Add pure snapshot tests**

Add this test for both backend reader/order helper exports once the helper is exported from `packageOrders.js`:

```js
test(`${name} builds order context with location snapshot`, () => {
  const context = readers.buildPackageOrderLocationContext({
    location: {
      id: 'pkg_test_001_loc_a',
      location_district: '广东省 / 深圳市 / 南山区',
      location_community: '前海花园',
      location_detail: '中心草坪',
      longitude: 113.9,
      latitude: 22.52
    }
  })

  assert.equal(context.location_id, 'pkg_test_001_loc_a')
  assert.equal(context.location_snapshot.location_community, '前海花园')
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: FAIL until the location context helper is exported and wired.

- [ ] **Step 3: Validate start location**

In both `createPackageStartOrder` implementations:

- Accept `locationId`.
- Load the location by ID.
- Require `location.package_id === packageId`.
- Require `Number(location.status) === 1`.
- Throw `createPackageServiceError(400, 1001, '请选择上课地点')` when missing or invalid.

- [ ] **Step 4: Store location in start order context**

Extend `buildPackageOrderContext` input with `location`. Add:

```js
location_id: location ? location.id : '',
location_snapshot: location
  ? {
      id: location.id,
      location_district: location.location_district || '',
      location_community: location.location_community || '',
      location_detail: location.location_detail || '',
      longitude: location.longitude ?? null,
      latitude: location.latitude ?? null
    }
  : null
```

- [ ] **Step 5: Store location on created groups**

Find the payment-success path that converts start orders into package groups. When calling `packageGroupsRepository.createPackageGroup`, pass:

```js
location_id: order.package_context.location_id || null,
location_snapshot: order.package_context.location_snapshot || null
```

- [ ] **Step 6: Inherit location for join orders**

In `createPackageJoinOrder`, build the join order context from `group.location_id` and `group.location_snapshot`. Do not accept request location for join.

- [ ] **Step 7: Update route body parsing**

In `backend/lindong-api/routes/package-orders.js`, read:

```js
const locationId = req.body.locationId || req.body.location_id || ''
```

Pass it into `createPackageStartOrder`.

- [ ] **Step 8: Run tests**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/lindong-api/routes/package-orders.js backend/lindong-api/shared/services/packageOrders.js backend/console-api-service/shared/services/packageOrders.js backend/lindong-api/shared/domain/packageGroupRules.js backend/console-api-service/tests/package-location-rules.test.cjs
git commit -m "feat: lock package group location"
```

---

### Task 5: Console API Location Management

**Files:**
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/shared/services/packageReaders.js`
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/console-api/routes/packages.js`
- Modify: `backend/console-api-service/repositories/packageGroupsRepository.js`

- [ ] **Step 1: Add payload normalization**

In `packageAdminService.js`, add a local helper:

```js
const normalizePackageLocationPayload = (locations = [], fallbackPayload = {}) => {
  const source = Array.isArray(locations) && locations.length
    ? locations
    : [{
        id: '',
        location_district: fallbackPayload.location_district,
        location_community: fallbackPayload.location_community,
        location_detail: fallbackPayload.location_detail,
        longitude: fallbackPayload.longitude,
        latitude: fallbackPayload.latitude,
        status: 1,
        sort_order: 0
      }]

  return source.map((item, index) => ({
    id: `${item.id || ''}`.trim(),
    location_district: normalizeText(item.location_district),
    location_community: normalizeText(item.location_community),
    location_detail: normalizeText(item.location_detail),
    longitude: normalizeOptionalNumber(item.longitude),
    latitude: normalizeOptionalNumber(item.latitude),
    sort_order: Number(item.sort_order) || index,
    status: Number(item.status) === 0 ? 0 : 1
  }))
}
```

- [ ] **Step 2: Validate at least one enabled location**

In create and update flows, after normalizing locations:

```js
ensureCondition(
  normalizedLocations.some(item => item.status === 1 && item.location_community && item.location_detail),
  {
    responseCode: 2001,
    statusCode: 400,
    message: '请至少配置一个启用地点'
  }
)
```

- [ ] **Step 3: Persist locations after package writes**

After `coursePackagesRepository.createPackage` and `updatePackage`, call:

```js
await coursePackageLocationsRepository.replaceLocationsForPackage({
  packageId: savedPackage.id || packageId,
  locations: normalizedLocations
})
```

- [ ] **Step 4: Return locations in package detail**

In detail responses, include:

```js
locations: await coursePackageLocationsRepository.listLocationsByPackageId(packageId)
```

Keep old `location_district`, `location_community`, `location_detail`, `longitude`, `latitude` fields mapped from the first enabled location for current UI compatibility.

- [ ] **Step 5: Include location display in group/order admin payloads**

When listing package groups and orders, join or batch-load locations and add:

```js
location_text: buildAdminLocationText(locationSnapshotOrFallback),
location_snapshot: locationSnapshotOrFallback
```

- [ ] **Step 6: Smoke check routes load**

Run:

```bash
node -e "require('./backend/console-api-service/console-api/services/packageAdminService.js'); console.log('package admin service loaded')"
```

Expected: prints `package admin service loaded`.

- [ ] **Step 7: Commit**

```bash
git add backend/console-api-service/console-api/services/packageAdminService.js backend/console-api-service/console-api/routes/packages.js backend/console-api-service/shared/services/packageReaders.js backend/console-api-service/repositories/packageGroupsRepository.js
git commit -m "feat: manage package locations in console api"
```

---

### Task 6: Console Frontend

**Files:**
- Modify: `console/src/types.ts`
- Modify: `console/src/pages/PackageFormPage.tsx`
- Modify: `console/src/pages/PackageGroupListPage.tsx`
- Modify: `console/src/pages/PackageGroupDetailPage.tsx`
- Modify: `console/src/pages/PackageOrderListPage.tsx`

- [ ] **Step 1: Add TypeScript types**

In `console/src/types.ts`, add:

```ts
export interface PackageLocation {
  id: string
  location_district: string
  location_community: string
  location_detail: string
  longitude: number | null
  latitude: number | null
  sort_order: number
  status: 0 | 1
  location_text?: string
}
```

Add `locations: PackageLocation[]` to `PackageDetail`. Add `location_text?: string` and `location_snapshot?: PackageLocation | null` to package group and order list item types.

- [ ] **Step 2: Update empty package**

In `PackageFormPage.tsx`, add one empty enabled location to `emptyPackage.locations`:

```ts
locations: [{
  id: '',
  location_district: '',
  location_community: '',
  location_detail: '',
  longitude: null,
  latitude: null,
  sort_order: 0,
  status: 1
}]
```

- [ ] **Step 3: Replace single-location form state with location rows**

Keep existing province/city/district UI for the currently edited location. Add `editingLocationIndex` state. Update `applyLocationSuggestion`, `resolveCoordinates`, and region setters to modify `form.locations[editingLocationIndex]`.

- [ ] **Step 4: Build payload with locations**

In `buildPayload`, include:

```ts
locations: form.locations.map((item, index) => ({
  id: item.id,
  location_district: item.location_district.trim(),
  location_community: item.location_community.trim(),
  location_detail: item.location_detail.trim(),
  longitude: item.longitude,
  latitude: item.latitude,
  sort_order: index,
  status: item.status
}))
```

Keep old single location fields set from the first enabled location:

```ts
const primaryLocation = form.locations.find(item => item.status === 1) || form.locations[0]
location_district: primaryLocation.location_district.trim()
location_community: primaryLocation.location_community.trim()
location_detail: primaryLocation.location_detail.trim()
longitude: primaryLocation.longitude
latitude: primaryLocation.latitude
```

- [ ] **Step 5: Add validation**

Before submit:

```ts
if (!form.locations.some(item => item.status === 1 && item.location_community.trim() && item.location_detail.trim())) {
  setError('请至少配置一个启用地点')
  setSaving(false)
  return
}
```

- [ ] **Step 6: Display group/order locations**

Add a secondary text line in group and order tables:

```tsx
<p className="table-subtext">地点：{item.location_text || '-'}</p>
```

- [ ] **Step 7: Run Console lint**

Run:

```bash
cd console
npm run lint
```

Expected: TypeScript compile succeeds.

- [ ] **Step 8: Commit**

```bash
git add console/src/types.ts console/src/pages/PackageFormPage.tsx console/src/pages/PackageGroupListPage.tsx console/src/pages/PackageGroupDetailPage.tsx console/src/pages/PackageOrderListPage.tsx
git commit -m "feat: edit package locations in console"
```

---

### Task 7: Mini Program Transforms And UI

**Files:**
- Modify: `miniprogram/utils/package.js`
- Modify: `miniprogram/pages/course/detail/index.js`
- Modify: `miniprogram/pages/course/detail/index.wxml`
- Modify: `miniprogram/pages/course/detail/index.wxss`
- Modify: `miniprogram/pages/package/start/index.js`
- Modify: `miniprogram/pages/package/start/index.wxml`
- Modify: `miniprogram/pages/package/start/index.wxss`
- Modify: `miniprogram/pages/payment/confirm/index.js`
- Modify: `miniprogram/pages/payment/confirm/index.wxml`
- Modify: `miniprogram/pages/group/detail/index.js`
- Modify: `miniprogram/pages/group/detail/index.wxml`
- Test: `miniprogram/tests/package-location-transform.test.cjs`

- [ ] **Step 1: Write transform tests**

Create `miniprogram/tests/package-location-transform.test.cjs`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const pkg = require('../utils/package')

test('normalizePackageDetail keeps supported locations', () => {
  const detail = pkg.normalizePackageDetail({
    id: 'pkg_test_001',
    name: '体适能',
    locations: [
      {
        id: 'loc_a',
        location_district: '广东省 / 深圳市 / 南山区',
        location_community: '前海花园',
        location_detail: '中心草坪',
        distance_meters: 120
      }
    ],
    active_groups: []
  })

  assert.equal(detail.locations.length, 1)
  assert.equal(detail.locations[0].locationCommunity, '前海花园')
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
node --test miniprogram/tests/package-location-transform.test.cjs
```

Expected: FAIL until `normalizePackageDetail` returns `locations`.

- [ ] **Step 3: Normalize locations**

In `miniprogram/utils/package.js`, add `normalizePackageLocation` and include `locations` on package detail:

```js
const normalizePackageLocation = item => ({
  id: item.id || item.location_id || '',
  locationDistrict: item.location_district || '',
  locationCommunity: item.location_community || '',
  locationDetail: item.location_detail || '',
  locationText: item.location_text || formatPackageLocationText(item),
  distanceMeters: Number.isFinite(Number(item.distance_meters)) ? Number(item.distance_meters) : null
})
```

- [ ] **Step 4: Pass coordinates to detail API**

In `miniprogram/pages/course/detail/index.js`, get cached/global location using the existing location utility used by home. Pass `lat/lng` into `fetchPackageDetail(packageId, { data: { lat, lng } })` or extend `fetchPackageDetail` to accept query params consistently with `fetchPackageList`.

- [ ] **Step 5: Show supported locations**

In detail WXML, insert a section before active groups:

```xml
<view wx:if="{{packageDetail.locations.length}}" class="weui-panel weui-ext-card page-section card-shadow">
  <view class="section-title">支持小区/场地</view>
  <view class="location-chip-list">
    <view wx:for="{{packageDetail.locations}}" wx:key="id" class="location-chip">
      <view class="location-chip-title">{{item.locationCommunity || item.locationText}}</view>
      <view class="location-chip-desc">{{item.locationDistrict}}</view>
    </view>
  </view>
</view>
```

- [ ] **Step 6: Show group location**

In active group cards, add:

```xml
<view class="group-progress-caption group-location">地点：{{item.locationText || '待确认'}}</view>
```

- [ ] **Step 7: Add start-page location selection**

In `package/start/index.js`, add `selectedLocationId` state. On load:

```js
const enabledLocations = packageDetail.locations || []
this.setData({
  selectedLocationId: enabledLocations.length === 1 ? enabledLocations[0].id : ''
})
```

Before submit:

```js
if (!this.data.selectedLocationId) {
  this.showError('请选择上课地点')
  return
}
```

Pass `locationId: this.data.selectedLocationId` into `createPackageStartOrder`.

- [ ] **Step 8: Add start-page WXML**

Insert after package title card:

```xml
<view wx:if="{{packageDetail.locations.length}}" class="weui-panel weui-ext-card page-section card-shadow">
  <view class="section-title">选择上课地点</view>
  <view class="location-option-list">
    <view
      wx:for="{{packageDetail.locations}}"
      wx:key="id"
      class="location-option {{selectedLocationId === item.id ? 'location-option--active' : ''}}"
      data-location-id="{{item.id}}"
      bindtap="handleLocationSelect"
    >
      <view class="location-option-title">{{item.locationCommunity || item.locationText}}</view>
      <view class="location-option-desc">{{item.locationDetail || item.locationDistrict}}</view>
    </view>
  </view>
</view>
```

- [ ] **Step 9: Display locked location in payment and group detail**

Use normalized payload fields `locationText` from order/group detail. Add a simple row:

```xml
<view class="detail-row">
  <text class="detail-row-label">上课地点</text>
  <text class="detail-row-value">{{detail.locationText || packageInfo.locationText}}</text>
</view>
```

- [ ] **Step 10: Run transform tests**

Run:

```bash
node --test miniprogram/tests/package-location-transform.test.cjs
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add miniprogram/utils/package.js miniprogram/pages/course/detail miniprogram/pages/package/start miniprogram/pages/payment/confirm miniprogram/pages/group/detail miniprogram/tests/package-location-transform.test.cjs
git commit -m "feat: select and display package locations"
```

---

### Task 8: Verification And Build

**Files:**
- Modify only files needed to fix failures found by commands below.

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional files from completed tasks are modified.

- [ ] **Step 2: Run backend helper tests**

Run:

```bash
node --test backend/console-api-service/tests/package-location-rules.test.cjs
```

Expected: PASS.

- [ ] **Step 3: Run existing backend tests**

Run:

```bash
node --test backend/console-api-service/tests/package-schedule-rules.test.cjs backend/console-api-service/tests/package-offline-refund.test.cjs
```

Expected: PASS.

- [ ] **Step 4: Run Mini Program transform tests**

Run:

```bash
node --test miniprogram/tests/package-location-transform.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Run Console lint**

Run:

```bash
cd console
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Run Console build**

Run:

```bash
cd console
npm run build:cloudbase
```

Expected: Vite build succeeds. Do not manually edit `console/dist`; if build output changes, leave it as generated output only if the user wants deployment assets included.

- [ ] **Step 7: Final status**

Run:

```bash
git status --short
```

Expected: intentional source changes only.

- [ ] **Step 8: Commit verification fixes**

If Step 2 through Step 6 required fixes:

```bash
git add <fixed-source-files>
git commit -m "fix: stabilize package multi-location flow"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Multi-location Console configuration: Task 5 and Task 6.
- Homepage nearest distance without community display: Task 3 and Task 7.
- Detail supported locations: Task 3 and Task 7.
- Start-page location selection: Task 4 and Task 7.
- Group cards show location and sort by distance/deadline: Task 3 and Task 7.
- Group location lock and compatibility fallback: Task 2, Task 3, and Task 4.
- Console group/order location display: Task 5 and Task 6.
- Migration and existing data compatibility: Task 1.

Risk checks:

- Payment and refund logic is touched only to carry location snapshots; existing amount, group status, and refund state rules stay unchanged.
- `course_packages` legacy location fields remain for compatibility.
- Historical groups without snapshots continue to display package fallback location.
