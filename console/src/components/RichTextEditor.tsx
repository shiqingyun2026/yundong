import { useEffect, useId, useRef } from 'react'

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  onUploadImage?: (file: File) => Promise<string>
}

const EMPTY_DOC_HTML = '<p></p>'

type ToolbarAction = {
  label: string
  isActive?: boolean
  onClick: () => void | Promise<void>
  disabled?: boolean
}

const normalizeContent = (value: string) => {
  const trimmed = `${value || ''}`.trim()
  return trimmed || EMPTY_DOC_HTML
}

export function RichTextEditor({ value, onChange, disabled = false, placeholder = '', onUploadImage }: RichTextEditorProps) {
  const inputId = useId()
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const lastSyncedValueRef = useRef(normalizeContent(value))

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https'
      }),
      Image
    ],
    content: normalizeContent(value),
    editorProps: {
      attributes: {
        class: 'rich-editor-content__inner',
        'data-placeholder': placeholder
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      lastSyncedValueRef.current = html
      onChange(html === EMPTY_DOC_HTML ? '' : html)
    }
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const normalized = normalizeContent(value)
    if (normalized === lastSyncedValueRef.current) {
      return
    }

    editor.commands.setContent(normalized, { emitUpdate: false })
    lastSyncedValueRef.current = normalized
  }, [editor, value])

  const handleSetLink = () => {
    if (!editor || disabled) {
      return
    }

    const previousUrl = editor.getAttributes('link').href || 'https://'
    const nextUrl = window.prompt('请输入链接地址', previousUrl)
    if (nextUrl === null) {
      return
    }

    const trimmedUrl = nextUrl.trim()
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmedUrl }).run()
  }

  const handleTriggerImageUpload = () => {
    if (disabled || !onUploadImage) {
      return
    }

    imageInputRef.current?.click()
  }

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editor || !onUploadImage) {
      event.target.value = ''
      return
    }

    try {
      const url = await onUploadImage(file)
      editor
        .chain()
        .focus()
        .setImage({
          src: url,
          alt: file.name.replace(/\.[^.]+$/, '') || '插图'
        })
        .run()
    } finally {
      event.target.value = ''
    }
  }

  const toolbarActions: ToolbarAction[] = [
    {
      label: '加粗',
      isActive: !!editor?.isActive('bold'),
      disabled: disabled || !editor,
      onClick: () => editor?.chain().focus().toggleBold().run()
    },
    {
      label: '斜体',
      isActive: !!editor?.isActive('italic'),
      disabled: disabled || !editor,
      onClick: () => editor?.chain().focus().toggleItalic().run()
    },
    {
      label: '无序列表',
      isActive: !!editor?.isActive('bulletList'),
      disabled: disabled || !editor,
      onClick: () => editor?.chain().focus().toggleBulletList().run()
    },
    {
      label: '有序列表',
      isActive: !!editor?.isActive('orderedList'),
      disabled: disabled || !editor,
      onClick: () => editor?.chain().focus().toggleOrderedList().run()
    },
    {
      label: '链接',
      isActive: !!editor?.isActive('link'),
      disabled: disabled || !editor,
      onClick: handleSetLink
    },
    {
      label: '图片',
      disabled: disabled || !editor || !onUploadImage,
      onClick: handleTriggerImageUpload
    },
    {
      label: '清除格式',
      disabled: disabled || !editor,
      onClick: () => editor?.chain().focus().unsetAllMarks().clearNodes().run()
    }
  ]

  return (
    <div className={`rich-editor ${disabled ? 'rich-editor--disabled' : ''}`}>
      <div className="rich-editor-toolbar" role="toolbar" aria-label="文本编辑工具栏">
        {toolbarActions.map(action => (
          <button
            key={action.label}
            className={`rich-editor-toolbar__button ${action.isActive ? 'rich-editor-toolbar__button--active' : ''}`}
            type="button"
            onClick={() => void action.onClick()}
            disabled={action.disabled}
            aria-pressed={action.isActive ? 'true' : 'false'}
          >
            {action.label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="rich-editor-content" />

      <input
        id={inputId}
        ref={imageInputRef}
        className="rich-editor-input"
        type="file"
        accept="image/*"
        onChange={event => void handleImageChange(event)}
        tabIndex={-1}
      />
    </div>
  )
}
