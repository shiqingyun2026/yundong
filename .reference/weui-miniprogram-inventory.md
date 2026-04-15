# weui-miniprogram Inventory

## Scope

This note is based on the local package currently installed in this repository:

- package: `miniprogram/node_modules/weui-miniprogram`
- vendored dist: `miniprogram/vendor/weui-miniprogram`
- version: `1.3.0`

The goal is to separate three things clearly:

1. What `weui-miniprogram` actually ships locally
2. What this mini program is already using
3. What still has no direct official mini program component equivalent in the local package

## Components Shipped Locally

The current local vendored package contains these component directories:

- `actionsheet`
- `badge`
- `cell`
- `cells`
- `checkbox`
- `checkbox-group`
- `dialog`
- `form`
- `form-page`
- `gallery`
- `grids`
- `half-screen-dialog`
- `icon`
- `loading`
- `msg`
- `navigation-bar`
- `searchbar`
- `slideview`
- `tabbar`
- `toptips`
- `uploader`

Supporting directories/files:

- `_commons`
- `index.js`
- `index.wxml`
- `index.wxss`
- `weui-wxss`

## Components Currently Used By This Mini Program

Current direct usage from page/component `usingComponents`:

- `badge`
- `cell`
- `cells`
- `checkbox`
- `checkbox-group`
- `dialog`
- `half-screen-dialog`
- `icon`
- `loading`
- `msg`
- `navigation-bar`
- `searchbar`
- `toptips`

Examples:

- `base-modal -> dialog`
- `loading -> loading`
- `empty-state -> msg`
- `login-sheet -> half-screen-dialog + icon + cells + checkbox-group + checkbox`
- `mine/agreement-list -> cells + cell`
- `home/location-search -> navigation-bar`
- `location-search -> searchbar`
- multiple pages -> `badge`, `icon`, `toptips`

## Components Shipped But Not Yet Used

These exist in the local package, but the current mini program does not directly use them yet:

- `actionsheet`
- `form`
- `form-page`
- `gallery`
- `grids`
- `slideview`
- `tabbar`
- `uploader`

## Important Clarification

The local package does **not** ship a direct official mini program component for all UI shapes currently in this project.

Most importantly, there is still no dedicated vendor component directory for:

- `button`
- `panel` or `card`
- capsule-style `tabs`

What exists instead is:

- official component primitives such as `cell`, `dialog`, `checkbox`, `badge`, `icon`
- official style semantics exposed through `index.wxss` / bundled `weui-wxss`

That means these UI shapes can still be built **within the `weui-miniprogram` system**, but not always as a direct `mp-*` vendor component.

## Practical Design Guidance

Best-practice layering for this repository should be:

1. Use official `weui-miniprogram` components whenever a local vendor component exists
2. Use official `weui-miniprogram/index.wxss` style semantics when the package does not provide a direct component
3. Avoid reintroducing `Tencent/weui` or standalone `weui.io` as a separate implementation baseline
4. Keep future audits grounded in the local vendored package, not just public docs pages

## Current Honest Status

The mini program is already based on `weui-miniprogram` as the only official source of truth.

However, it is not accurate to claim that every single UI element has a direct official `weui-miniprogram` component equivalent, because the local package itself does not provide direct vendor components for button, panel/card, or capsule tabs.

That distinction should be preserved in future refactors and documentation.
