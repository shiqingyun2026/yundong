# Package Console Rich Text Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a basic rich text editor to the package admin page for `coach_intro` and `description` while keeping the existing HTML-string save contract unchanged.

**Architecture:** Introduce a focused `RichTextEditor` React component backed by Tiptap, then swap the two `textarea` fields in `PackageFormPage` to use it. Keep image upload and payload building in the page so business logic stays where it already lives, and add focused tests around the new component and the page integration.

**Tech Stack:** React 19, TypeScript, Vite 6, Tiptap, Node test runner, existing `uploadImage` API helper

---

### Task 1: Add the editor dependency and capture the failing integration expectations

**Files:**
- Modify: `console/package.json`
- Create: `console/src/components/__tests__/RichTextEditor.test.tsx`
- Modify: `console/src/pages/PackageFormPage.tsx`

- [ ] **Step 1: Add the Tiptap packages to `console/package.json`**

```json
"dependencies": {
  "@douyinfe/semi-icons": "2.94.1",
  "@tiptap/extension-link": "...",
  "@tiptap/react": "...",
  "@tiptap/starter-kit": "...",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.13.1"
}
```

- [ ] **Step 2: Add a failing editor test that proves formatting and image insertion callbacks are needed**

```ts
it('emits html with bold formatting when toolbar bold is used', async () => {
  render(<RichTextEditor value="<p>abc</p>" onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: '加粗' }))
  await user.type(editor, 'x')
  expect(lastHtml).toContain('<strong>')
})
```

- [ ] **Step 3: Add a failing page-level test or assertion target for the two rich text fields**

```ts
expect(screen.getByLabelText('教练简介')).not.toHaveAttribute('data-plain-textarea')
expect(screen.getByLabelText('课包介绍')).not.toHaveAttribute('data-plain-textarea')
```

- [ ] **Step 4: Run the targeted test command and verify it fails for the missing component/integration**

Run: `cd console && npm test -- --runInBand`
Expected: FAIL because `RichTextEditor` does not exist yet or expected toolbar behavior is missing

### Task 2: Implement the reusable `RichTextEditor` component

**Files:**
- Create: `console/src/components/RichTextEditor.tsx`
- Modify: `console/src/styles.css`
- Test: `console/src/components/__tests__/RichTextEditor.test.tsx`

- [ ] **Step 1: Create the minimal editor component API**

```ts
type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  onUploadImage?: (file: File) => Promise<string>
}
```

- [ ] **Step 2: Implement Tiptap with only the allowed extensions**

```ts
const editor = useEditor({
  editable: !disabled,
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false
    }),
    Link.configure({ openOnClick: false })
  ],
  content: value || '<p></p>',
  onUpdate: ({ editor }) => onChange(editor.getHTML())
})
```

- [ ] **Step 3: Add the basic toolbar actions**

```ts
[
  { label: '加粗', action: () => editor.chain().focus().toggleBold().run() },
  { label: '斜体', action: () => editor.chain().focus().toggleItalic().run() },
  { label: '无序列表', action: () => editor.chain().focus().toggleBulletList().run() },
  { label: '有序列表', action: () => editor.chain().focus().toggleOrderedList().run() },
  { label: '链接', action: handleSetLink },
  { label: '图片', action: openImagePicker },
  { label: '清除格式', action: () => editor.chain().focus().unsetAllMarks().clearNodes().run() }
]
```

- [ ] **Step 4: Implement link insertion with a browser prompt**

```ts
const href = window.prompt('请输入链接地址', currentHref || 'https://')
if (href) {
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}
```

- [ ] **Step 5: Implement image upload insertion via callback**

```ts
const url = await onUploadImage(file)
editor.chain().focus().setImage?.({ src: url, alt: altText }).run()
```

Note: if `setImage` is not available from `StarterKit`, insert raw HTML with:

```ts
editor.chain().focus().insertContent(`<p><img src="${url}" alt="${altText}" /></p>`).run()
```

- [ ] **Step 6: Add compact editor styles in `console/src/styles.css`**

```css
.rich-editor { border: 1px solid rgba(20, 58, 82, 0.14); border-radius: 18px; }
.rich-editor-toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; }
.rich-editor-content { min-height: 180px; padding: 16px; line-height: 1.8; }
```

- [ ] **Step 7: Run the focused component test and verify it passes**

Run: `cd console && npm test -- RichTextEditor`
Expected: PASS for the new component coverage

### Task 3: Replace the two `textarea` fields in `PackageFormPage`

**Files:**
- Modify: `console/src/pages/PackageFormPage.tsx`
- Test: `console/src/pages/__tests__/PackageFormPage.rich-text.test.tsx`

- [ ] **Step 1: Replace the `coach_intro` textarea with `RichTextEditor`**

```tsx
<RichTextEditor
  value={form.coach_intro}
  onChange={value => updateField('coach_intro', value)}
  disabled={!isEditable}
  placeholder="请输入教练简介"
  onUploadImage={file => uploadRichTextImage(file, '教练简介图')}
/>
```

- [ ] **Step 2: Replace the `description` textarea with `RichTextEditor`**

```tsx
<RichTextEditor
  value={form.description}
  onChange={value => updateField('description', value)}
  disabled={!isEditable}
  placeholder="请输入课包介绍"
  onUploadImage={file => uploadRichTextImage(file, '课包介绍图')}
/>
```

- [ ] **Step 3: Refactor the old rich-text image upload helper into a callback that returns a URL**

```ts
const uploadRichTextImage = async (file: File, altText: string) => {
  setUploading('上传图片中...')
  const url = await uploadImage(file, 'course-detail')
  return { url, altText }
}
```

Then keep insertion responsibility inside `RichTextEditor`.

- [ ] **Step 4: Remove the old upload button + preview duplication for the two rich text fields**

```tsx
// remove separate "上传图片并插入介绍" button block
// remove description-preview rich-preview blocks tied to coach_intro / description
```

- [ ] **Step 5: Keep the payload logic unchanged except for consuming editor-produced HTML**

```ts
coach_intro: form.coach_intro.trim(),
description: form.description.trim(),
```

- [ ] **Step 6: Run a page-level test or TypeScript-only verification for the form integration**

Run: `cd console && npm run lint`
Expected: PASS with no type errors from the new editor props or form integration

### Task 4: Verify saved HTML compatibility and regression safety

**Files:**
- Modify: `console/src/lib/html.ts` (only if needed)
- Test: `console/src/components/__tests__/RichTextEditor.test.tsx`
- Test: `miniprogram/tests/package-rich-text-linebreaks.test.cjs` (read-only regression awareness)

- [ ] **Step 1: Add assertions that editor output stays inside supported tags**

```ts
expect(html).toContain('<strong>')
expect(html).toContain('<ul>')
expect(html).toContain('<a href=')
expect(html).toContain('<img src=')
```

- [ ] **Step 2: Confirm the existing preview sanitizer still allows the produced tags**

Run: `cd console && npm run lint`
Expected: PASS without needing to widen the sanitizer allowlist

- [ ] **Step 3: Run the relevant miniprogram regression test to confirm downstream rendering assumptions still hold**

Run: `node --test miniprogram/tests/package-rich-text-linebreaks.test.cjs`
Expected: PASS

- [ ] **Step 4: Run the final verification set**

Run: `cd console && npm run lint`
Expected: PASS

Run: `node --test miniprogram/tests/package-rich-text-linebreaks.test.cjs`
Expected: PASS

## Self-Review

- Spec coverage: the plan covers the new editor component, the two package form fields, existing upload reuse, preview removal, and verification in both console and miniprogram.
- Placeholder scan: no `TODO` or “handle later” gaps remain; each task names exact files and commands.
- Type consistency: the plan uses `value`, `onChange`, `disabled`, `placeholder`, and `onUploadImage` consistently across the component and the page.
