import { useEffect, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code2,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
} from 'lucide-react'

import type { RichTextContent } from '../../types/docs'

type RichDocumentEditorProps = {
  content: RichTextContent
  editable: boolean
  onChange: (content: RichTextContent, text: string) => void
  variant?: 'default' | 'paper'
}

type ToolButtonProps = {
  title: string
  icon: ComponentType<{ className?: string }>
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

const textColors = ['#f0f0ff', '#93c5fd', '#a7f3d0', '#fcd34d', '#fca5a5']
const highlightColors = ['#312e81', '#064e3b', '#78350f', '#7f1d1d']

function ToolButton({ title, icon: Icon, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md border text-text-secondary transition',
        active
          ? 'border-accent-primary/60 bg-accent-primary/15 text-text-primary'
          : 'border-border-subtle bg-bg-secondary hover:bg-bg-hover hover:text-text-primary',
        disabled ? 'cursor-not-allowed opacity-45' : '',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-card p-1">{children}</div>
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', previous ?? 'https://')
  if (url === null) return

  const trimmed = url.trim()
  if (!trimmed) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

function insertImage(editor: Editor) {
  const url = window.prompt('Image URL')
  if (!url?.trim()) return
  editor.chain().focus().setImage({ src: url.trim() }).run()
}

function ResizableImageView(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor } = props

  const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : undefined
  const align = typeof node.attrs.align === 'string' ? node.attrs.align : 'center'

  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'

  function startResize(e: React.MouseEvent<HTMLButtonElement>, direction: 'left' | 'right') {
    e.preventDefault()
    e.stopPropagation()
    if (!editor.isEditable) return

    const startX = e.clientX
    const startWidth = typeof width === 'number' ? width : 480

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      const next = Math.max(120, Math.min(1100, Math.round(startWidth + (direction === 'right' ? delta : -delta))))
      updateAttributes({ width: next })
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <NodeViewWrapper className="daftar-image-node" data-selected={selected ? '1' : '0'}>
      <div className="daftar-image-frame" style={{ justifyContent: justify }}>
        <div className="daftar-image-box" style={{ width: width ? `${width}px` : undefined }}>
          <img src={src} alt={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''} draggable={false} />
          {editor.isEditable && selected ? (
            <>
              <button
                type="button"
                aria-label="Resize image"
                className="daftar-image-handle left"
                onMouseDown={(e) => startResize(e, 'left')}
              />
              <button
                type="button"
                aria-label="Resize image"
                className="daftar-image-handle right"
                onMouseDown={(e) => startResize(e, 'right')}
              />
            </>
          ) : null}
        </div>
      </div>
      <NodeViewContent className="hidden" />
    </NodeViewWrapper>
  )
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-width')
          const value = raw ? Number(raw) : NaN
          return Number.isFinite(value) ? value : null
        },
        renderHTML: (attrs) => (attrs.width ? { 'data-width': String(attrs.width) } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => (attrs.align ? { 'data-align': String(attrs.align) } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

export function RichDocumentEditor({ content, editable, onChange, variant = 'default' }: RichDocumentEditorProps) {
  const isPaperVariant = variant === 'paper'
  const editorSurfaceClass = isPaperVariant
    ? 'daftar-editor daftar-editor-paper min-h-[1024px] px-14 py-12 focus:outline-none'
    : 'daftar-editor min-h-[520px] px-8 py-7 focus:outline-none'

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Write the answer your team will need next time...',
      }),
    ],
    [],
  )

  const editor = useEditor({
    extensions,
    content: content as JSONContent,
    editable,
    editorProps: {
      attributes: {
        class: editorSurfaceClass,
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getJSON() as RichTextContent, nextEditor.getText())
    },
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  if (!editor) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-bg-hover" />
        <div className="mt-4 h-[420px] animate-pulse rounded bg-bg-hover" />
      </div>
    )
  }

  return (
    <div
      className={
        isPaperVariant
          ? 'overflow-hidden rounded-sm bg-white'
          : 'overflow-hidden rounded-lg border border-border-subtle bg-bg-card'
      }
    >
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-bg-secondary/95 px-3 py-2 backdrop-blur">
          <ToolbarGroup>
            <ToolButton
              title="Bold"
              icon={Bold}
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolButton
              title="Italic"
              icon={Italic}
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolButton
              title="Underline"
              icon={Underline}
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
            <ToolButton
              title="Strikethrough"
              icon={Strikethrough}
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolButton
              title="Inline code"
              icon={Code2}
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            />
            <ToolButton
              title="Clear formatting"
              icon={Eraser}
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolButton
              title="Heading 1"
              icon={Heading1}
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolButton
              title="Heading 2"
              icon={Heading2}
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolButton
              title="Heading 3"
              icon={Heading3}
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolButton
              title="Bullet list"
              icon={List}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolButton
              title="Numbered list"
              icon={ListOrdered}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolButton
              title="Task list"
              icon={CheckSquare}
              active={editor.isActive('taskList')}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            />
            <ToolButton
              title="Blockquote"
              icon={Quote}
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolButton
              title="Divider"
              icon={Minus}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolButton
              title="Align left"
              icon={AlignLeft}
              active={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            />
            <ToolButton
              title="Align center"
              icon={AlignCenter}
              active={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            />
            <ToolButton
              title="Align right"
              icon={AlignRight}
              active={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            />
            <ToolButton
              title="Justify"
              icon={AlignJustify}
              active={editor.isActive({ textAlign: 'justify' })}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolButton title="Link" icon={Link2} active={editor.isActive('link')} onClick={() => setLink(editor)} />
            <ToolButton title="Image" icon={ImagePlus} onClick={() => insertImage(editor)} />
            <ToolButton
              title="Image align left"
              icon={AlignLeft}
              disabled={!editor.isActive('image')}
              active={editor.isActive('image', { align: 'left' })}
              onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}
            />
            <ToolButton
              title="Image align center"
              icon={AlignCenter}
              disabled={!editor.isActive('image')}
              active={editor.isActive('image', { align: 'center' })}
              onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}
            />
            <ToolButton
              title="Image align right"
              icon={AlignRight}
              disabled={!editor.isActive('image')}
              active={editor.isActive('image', { align: 'right' })}
              onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}
            />
            <ToolButton
              title="Table"
              icon={Table2}
              active={editor.isActive('table')}
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            {textColors.map((color) => (
              <button
                key={color}
                type="button"
                title="Text color"
                aria-label="Text color"
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="h-8 w-8 rounded-md border border-border-subtle bg-bg-secondary p-1 transition hover:bg-bg-hover"
              >
                <span className="block h-full w-full rounded-sm" style={{ backgroundColor: color }} />
              </button>
            ))}
            {highlightColors.map((color) => (
              <button
                key={color}
                type="button"
                title="Highlight"
                aria-label="Highlight"
                onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-secondary text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
              >
                <Highlighter className="h-4 w-4" style={{ color }} />
              </button>
            ))}
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolButton
              title="Undo"
              icon={Undo2}
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            />
            <ToolButton
              title="Redo"
              icon={Redo2}
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            />
          </ToolbarGroup>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  )
}
