# Package Group Flexible Thresholds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow package group types such as 3-4 and 5-6 people to fill immediately at the upper count and succeed at deadline when the lower count is reached.

**Architecture:** Extend package group pricing/configuration with `min_success_count` while keeping `target_count` as the immediate-fill count. Persist the minimum threshold on each package group so historical groups keep their original rules, and update expiration cleanup to promote eligible expired groups to success instead of failing/refunding them.

**Tech Stack:** Node.js `node:test`, MySQL repositories, Express services, React/Vite console frontend, WeChat mini program JavaScript.

---

### Task 1: Backend Rules and Expiration

**Files:**
- Modify: `backend/lindong-api/shared/domain/packageGroupRules.js`
- Modify: `backend/lindong-api/shared/services/packageGroupStore.js`
- Modify: `backend/lindong-api/shared/services/packageOrders.js`
- Modify: `backend/lindong-api/repositories/packageGroupsRepository.js`
- Test: `backend/tests/package-group-rules.test.js`
- Test: `backend/tests/package-orders.test.js`

- [ ] Add failing tests for `min_success_count` deadline success.
- [ ] Implement rule helpers and package group persistence.
- [ ] Update cleanup to split expired groups into success and failed paths.
- [ ] Run `cd backend && node --test tests/package-group-rules.test.js tests/package-orders.test.js`.

### Task 2: Admin Configuration and SQL Docs

**Files:**
- Modify: `backend/console-api-service/shared/domain/packageGroupRules.js`
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/repositories/packageGroupsRepository.js`
- Modify: `backend/lindong-api/repositories/coursePackagesRepository.js`
- Modify: `backend/console-api-service/repositories/coursePackagesRepository.js`
- Add: `docs/sql/package_group_min_success_count_migration.sql`
- Test: `backend/tests/package-group-admin.test.js`

- [ ] Normalize `min_success_count` in group price config.
- [ ] Validate `1 <= min_success_count <= target_count`.
- [ ] Persist and read `min_success_count` for package group records.
- [ ] Provide DMS-ready SQL migration with precheck and rollback notes.

### Task 3: Mini Program and Console Display

**Files:**
- Modify: `console/src/pages/PackageFormPage.tsx`
- Modify: `console/src/types.ts`
- Modify: `miniprogram/utils/package.js`
- Modify: `miniprogram/pages/package/start/index.wxml`
- Modify: `miniprogram/pages/group/detail/index.js`
- Modify: `miniprogram/pages/group/detail/index.wxml`
- Modify: `miniprogram/pages/payment/confirm/index.wxml`

- [ ] Add minimum-success field to package form rows.
- [ ] Render range labels such as `3～4人团`.
- [ ] Show deadline fallback rule text in package start, payment confirm, and group detail.
- [ ] Run focused JS tests and frontend checks where available.
