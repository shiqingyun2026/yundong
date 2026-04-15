# weui-miniprogram Source Analysis

## Local Clone

Cloned from:

- `https://github.com/wechat-miniprogram/weui-miniprogram.git`

Local path:

- [`/Users/justin/Developer/yundong/.reference/weui-miniprogram-source`](/Users/justin/Developer/yundong/.reference/weui-miniprogram-source)

Current cloned `package.json` version:

- `1.5.6`

Current project installed package version:

- `miniprogram/package.json` -> `1.3.0`

## Most Important Finding

The source repository itself explicitly states that `weui-miniprogram` is built on top of `weui-wxss`.

Evidence:

- `README.md`: "这是一套基于样式库 weui-wxss 开发的小程序扩展组件库"
- `package.json`: build script copies `weui.wxss` into `miniprogram_dist`
- `package.json`: devDependency includes `weui-wxss`

This means:

- `weui-miniprogram` is the official mini program component baseline
- but it is not a system that exists independently from `weui-wxss`

## What Exists As Real Source Components

Under `src/components`, the source repo contains these real components:

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

## What Does Not Exist As Real Source Components

There is no dedicated `src/components/...` directory for:

- `button`
- `panel`
- `navbar`

That means these are not missing from docs only. They are not shipped as first-class mini program source components in the repo.

## Why Confusion Happens

The source repo includes example pages such as:

- `src/example/button/button.wxml`
- `src/example/panel/panel.wxml`
- `src/example/navbar/navbar.wxml`

These examples use official WeUI class semantics like:

- `weui-btn`
- `weui-panel`
- `weui-navbar`

So these patterns are definitely part of the WeUI design language.

But they are **example implementations using style semantics**, not dedicated source components like `src/components/button` or `src/components/panel`.

## Implication For This Project

When this repository directly uses:

- `mp-cell`
- `mp-cells`
- `mp-dialog`
- `mp-loading`
- `mp-msg`
- `mp-navigation-bar`
- `mp-searchbar`
- `mp-checkbox`
- `mp-checkbox-group`
- `mp-badge`
- `mp-icon`
- `mp-toptips`

that is direct official component usage.

When this repository uses:

- `weui-btn`
- `weui-panel`
- `weui-navbar`
- `weui-tabbar`

it is still inside the `weui-miniprogram` system, but through official style semantics rather than a dedicated mini program component directory.

## Best-Practice Conclusion

For this project, the most accurate and honest architecture target is:

1. `weui-miniprogram` as the only official source of truth
2. direct vendor components wherever the source repo provides real components
3. official `weui-miniprogram` style semantics for UI patterns that exist only as examples / style language
4. no reliance on `Tencent/weui` or `weui.io` as a separate implementation baseline

## Strict Conclusion

If someone says "button/panel/navbar exist in WeUI", that is true at the design-language/example level.

If someone says "button/panel/navbar exist as real `weui-miniprogram` source components", that is false for the currently cloned source repository.
