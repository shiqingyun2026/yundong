# 课包后台基础文本编辑器设计

## 背景

当前课包后台在 [console/src/pages/PackageFormPage.tsx](/Users/yun/lindong/console/src/pages/PackageFormPage.tsx:1) 中，`coach_intro` 和 `description` 仍使用普通 `textarea` 编辑。现状支持输入纯文本和手写 HTML，但不支持可视化的加粗、列表、链接等基础富文本操作，运营使用成本较高。

小程序详情页和拼团详情页已经通过 `rich-text` 渲染这两个字段，并且当前链路接受 HTML 字符串作为存储格式，因此本次设计以“在后台补一个基础可视化编辑器，同时保持现有保存格式不变”为目标。

## 目标

- 仅在课包后台接入基础文本编辑器。
- 仅覆盖 `coach_intro` 和 `description` 两个字段。
- 保持现有后端接口和字段结构不变，继续提交 HTML 字符串。
- 保持小程序现有展示链路兼容，不引入新的内容格式。

## 非目标

- 不改旧课程后台页面 `CourseFormPage`。
- 不引入完整 CMS 或复杂排版能力。
- 不改后端存储结构，不新增 JSON 富文本 schema。
- 不在第一版支持表格、引用块、标题层级、附件等高级能力。

## 方案对比

### 方案 A：Tiptap 自定义基础工具栏

- 优点：
  - 与当前 `React + TypeScript + Vite` 技术栈贴合。
  - 可以精确限制输出能力，避免运营编辑出小程序不稳定的 HTML。
  - 后续扩展图片、链接、列表等能力较平滑。
- 缺点：
  - 需要我们自己做一层轻量工具栏和图片插入交互。

### 方案 B：Quill

- 优点：
  - 接入速度快，开箱即用。
  - 做基础富文本足够。
- 缺点：
  - 后续定制工具栏、HTML 输出控制和图片插入体验的灵活度一般。

### 方案 C：TinyMCE

- 优点：
  - 成熟、完整、现成度高。
- 缺点：
  - 对当前需求偏重，依赖和配置复杂度更高。

## 结论

采用方案 A：`Tiptap`。

原因：

- 本次只需要基础富文本能力，范围很窄，`Tiptap` 足够且不重。
- 当前页面已经有自定义上传逻辑和自定义预览逻辑，`Tiptap` 更适合与现有业务代码融合。
- 可以继续把编辑结果收敛成 HTML 字符串，保持与小程序和后端的兼容性。

## 功能范围

第一版工具栏仅支持以下能力：

- 段落换行
- 加粗
- 斜体
- 无序列表
- 有序列表
- 插入链接
- 插入图片
- 清除格式

第一版不支持：

- 标题
- 表格
- 引用块
- 下划线
- 字体颜色
- 对齐方式
- 粘贴 Word 富文本增强清洗

## 架构设计

### 新增组件

新增可复用组件：

- `console/src/components/RichTextEditor.tsx`

组件职责：

- 封装 `Tiptap` 编辑器实例
- 暴露 `value` / `onChange` 接口，继续按受控组件方式与表单集成
- 提供本次所需的基础工具栏
- 提供“插入链接”和“插入图片”的最小交互

建议组件接口：

```ts
type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  onUploadImage?: (file: File) => Promise<string>
}
```

### 页面接入点

在 [console/src/pages/PackageFormPage.tsx](/Users/yun/lindong/console/src/pages/PackageFormPage.tsx:1) 中：

- 用 `RichTextEditor` 替换 `coach_intro` 的 `textarea`
- 用 `RichTextEditor` 替换 `description` 的 `textarea`
- 保留现有 `form.coach_intro` / `form.description` 状态字段
- 保留现有 `buildPayload` 逻辑，继续提交字符串

### 图片上传

继续复用页面当前已有的上传能力：

- 复用 `uploadImage`
- 复用当前课包页面的上传 loading 态
- 上传成功后由编辑器把 `<img src="...">` 插入当前光标位置

不新增新的后端上传接口。

### 预览区处理

当前页面已经有 HTML 预览区：

- [console/src/pages/PackageFormPage.tsx](/Users/yun/lindong/console/src/pages/PackageFormPage.tsx:994)
- [console/src/pages/PackageFormPage.tsx](/Users/yun/lindong/console/src/pages/PackageFormPage.tsx:1062)

第一版建议移除这两块独立预览区，理由如下：

- 编辑器本身就是所见即所得，继续保留预览会造成重复信息。
- 能减少页面高度和维护成本。
- 也能降低“编辑区和预览区样式不一致”的理解负担。

如果实施中发现运营仍需要额外预览，再单独加回。

## 数据兼容性

本次不改以下内容：

- 后端 `PackageDetail` 数据结构
- `coach_intro` / `description` 字段类型
- 小程序渲染入口

编辑器输出仍为 HTML 字符串，因此现有内容可以继续显示：

- 历史纯文本内容：可直接加载，编辑器显示为普通段落
- 历史手写 HTML 内容：在白名单范围内继续显示
- 新增加粗、列表、链接、图片：保存后由小程序原有 `rich-text` 渲染

## 风险与约束

### 风险 1：运营输入的 HTML 兼容性

历史数据里如果存在复杂或非标准 HTML，编辑器回显可能与原始源码不完全一致。  
处理策略：

- 第一版只保证当前后台常见内容和小程序支持内容的稳定编辑。
- 对极端历史富文本不做“源码级完全保真”承诺。

### 风险 2：图片样式一致性

小程序侧已有图片样式归一逻辑；后台编辑器插入图片时应尽量输出简单、干净的 `<img src="...">`，不要额外写复杂内联样式。

### 风险 3：链接能力的边界

第一版仅支持插入普通超链接，不额外支持 target、nofollow、按钮式链接等扩展能力。

## 实施步骤

1. 在 `console` 安装 `Tiptap` 基础依赖。
2. 新增 `RichTextEditor` 组件和配套基础样式。
3. 在 `PackageFormPage` 中替换两个 `textarea`。
4. 接入现有图片上传逻辑。
5. 删除原有独立 HTML 预览区。
6. 本地验证保存、回显和页面类型检查。

## 验证标准

### 后台

- 可以对 `coach_intro` 和 `description` 进行加粗编辑。
- 可以插入列表、链接、图片。
- 保存后重新进入编辑页，格式仍然保留。
- `view` 模式下内容可正常只读展示。

### 小程序

- 课程详情页可正常展示加粗文本。
- 课程详情页可正常展示列表、链接、图片。
- 拼团详情页可正常展示同样内容。

### 工程质量

- `console` 类型检查通过。
- 不影响现有课包保存接口。
- 不改动后端和小程序数据结构。

## 实施后续

如果这版上线后运营还有更强诉求，再考虑第二阶段增强：

- 标题
- 引用块
- 更友好的链接编辑弹层
- 图片对齐/删除
- 更严格的 HTML 清洗策略
