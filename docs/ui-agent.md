# 项目UI开发规范 (基于微信小程序设计指南)

**适用对象**: 所有AI编程助手 (如Codex, Copilot, Cursor等)
**核心目的**: 确保AI助手能生成高度符合微信设计规范、具备优秀用户体验和一致性的代码。

## 一、核心设计原则 (Design Principles)

在生成任何UI代码前，必须遵循以下由微信官方提出的四项基本原则[reference:14]：
1.  **友好礼貌**：减少无关的设计元素对用户目标的干扰，礼貌地引导用户，高效地完成任务[reference:15]。
2.  **清晰明确**：导航清晰，告知用户当前的位置、可以去哪里、如何返回[reference:16]。页面内使用`<navigator>`组件。
3.  **便捷优雅**：UI设计应简洁明了，聚焦核心功能，确保交互流程顺畅，操作便捷[reference:17]。
4.  **统一稳定**：所有页面的视觉风格、交互方式、文案语气必须保持高度统一[reference:18]。

## 二、视觉语言 (Visual Language)

### 2.1 颜色系统 (Color Palette)
所有颜色应以CSS变量的形式定义，方便一键切换主题。
- **主色调 (Primary)**: `#07C160` (微信绿)，用于主按钮、重要链接等[reference:19]。
- **辅助色 (Secondary)**: `#576B95` (微信蓝)，用于辅助按钮、标签等[reference:20]。
- **文字颜色**:
  - 主要文字: `#353535`[reference:21]
  - 次要文字: `#888888`[reference:22]
- **背景色**:
  - 页面基础: `#F7F7F7`[reference:23]
  - 卡片、列表项: `#FFFFFF`[reference:24]
- **分割线**: `#E5E5E5`[reference:25]
- **App端安全区域**: 顶部`statusBar: 44px`，底部`safeArea: 34px`[reference:26]。

### 2.2 字体与排版 (Typography)
- **主标题 (H1)**: `18px`, 粗体 (bold)[reference:27]
- **副标题 (H2)**: `16px`, 常规 (regular)[reference:28]
- **正文 (Body)**: `14px`, 常规[reference:29]
- **辅助信息/说明文字 (Caption)**: `12px` 或 `10px`[reference:30]

### 2.3 间距系统 (Spacing Scale)
遵守严格倍数规则，确保整体布局的统一性和节奏感。
- **基准值**: `8rpx`
- **刻度**：`0`, `8rpx`, `16rpx`, `24rpx`, `32rpx`, `48rpx`
- **应用示例**: 页面边距`16rpx`，卡片间距`12rpx`，元素间距`8rpx`/`16rpx`/`24rpx`[reference:31]

### 2.4 图标 (Icons)
- **底部标签栏图标**: 统一为**81rpx**，使用边缘清晰的PNG或SVG格式[reference:32]。
- **列表内图标**: 推荐尺寸`24x24px`，旁边的小箭头为`16x16px`[reference:33]。
- **图标库**: 优先使用 `Icons8`[reference:34]。

## 三、组件规格 (Component Specs)

### 3.1 按钮 (Buttons)
- **高度**: 统一 `44px`[reference:35]。
- **圆角**: `4px`，务必重置小程序Button的默认样式（border:0等）[reference:36]。
- **主按钮 (Primary)**: 背景色`#07C160`，文字`#FFFFFF`，字号`16px`[reference:37]。
- **次要按钮 (Secondary)**: 背景色透明，边框色`#07C160`，文字色`#07C160`[reference:38]。
- **禁用状态 (Disabled)**: 降低不透明度至 `0.4`。

### 3.2 输入框 (Input Fields)
- **高度**: `44px`[reference:39]。
- **默认边框**: `1px solid #E5E5E5`[reference:40]。
- **聚焦边框**: `1px solid #07C160`[reference:41]。
- **内边距**: `12px`[reference:42]。
- **圆角**: `4px`[reference:43]。

### 3.3 列表 (Lists)
- **单项最小高度**: `44px`[reference:44]。
- **分割线**: `1px solid #E5E5E5`[reference:45]。
- **内容内边距**: `16px`[reference:46]。
- **交互区域**: 确保每个可点击区域不小于 `44x44px`。

## 四、布局与导航 (Layout & Navigation)

1.  **固定元素**: 顶部导航栏 (`128rpx`) 和底部标签栏 (`98rpx`) 为小程序固定样式，其高度和层级应被严格遵守[reference:47]。
2.  **顶部标题栏配色**: 必须为内容区预留空间。开发者仅可改变其背景颜色，并提供深浅两种配色方案以适配页面风格[reference:48]。
3.  **全局布局**: 页面根容器默认使用Flexbox。
 

## 五、UI库使用最高准则

**本项目已集成 WeUI 组件库，所有 UI 开发必须遵守以下优先级：**

1.  **功能优先**：只要 WeUI 现有组件（如 `mp-button`, `mp-cells`, `mp-dialog` 等）能满足功能，**必须优先使用**，不得用 `<view>` 重新造轮子。
2.  **定制方式**：如需调整 WeUI 组件的颜色或间距，**优先使用 WeUI 暴露的 CSS 变量（Custom Properties）** 进行修改，或使用组件的 `ext-class` 添加一个自定义类名，避免直接覆盖组件内部的基础类名。
3.  **回退策略**：仅在 WeUI 组件无法满足设计需求时，才按照本规范的其他视觉规则（颜色、间距等）编写自定义组件。