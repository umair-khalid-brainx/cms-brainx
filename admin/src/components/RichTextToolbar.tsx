import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import type { RichtextField } from '@puckeditor/core'
import { normaliseHref } from '../lib/richTextLink'
import './RichTextToolbar.css'

type MenuProps = Parameters<NonNullable<RichtextField['renderMenu']>>[0]

// The editing controls for every rich-text field (BLK-05, BLK-07): exactly the
// set the client's requirements ask for (headings, paragraphs, lists, links,
// quotations) plus bold and italic, and nothing else. Puck's default menus also
// offer underline and alignment, which the editor has switched off (puck/config.tsx
// `richTextOptions`) and the API's sanitiser would strip, so both are replaced
// rather than left with greyed-out buttons.
//
// One implementation, two places: the sidebar field (`panel`) and the floating
// menu that appears on the canvas while editing in place (`inline`), so the two
// can't drift apart.
export function RichTextToolbar(props: MenuProps) {
  return <RichTextControls {...props} variant="panel" />
}

export function RichTextInlineMenu(props: MenuProps) {
  return <RichTextControls {...props} variant="inline" />
}

function RichTextControls({ editor, readOnly, variant }: MenuProps & { variant: 'panel' | 'inline' }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const linkButton = useRef<HTMLButtonElement>(null)
  // Puck mounts each field twice, so ids must be unique per instance.
  const uid = useId()
  const linkBoxId = `${uid}-link`
  const linkInputId = `${uid}-link-input`
  const linkErrorId = `${uid}-link-error`

  if (!editor) return null

  const disabled = readOnly
  const block = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : 'p'

  function setBlock(value: string) {
    const chain = editor!.chain().focus()
    if (value === 'h2') chain.setHeading({ level: 2 }).run()
    else if (value === 'h3') chain.setHeading({ level: 3 }).run()
    else chain.setParagraph().run()
  }

  function openLink() {
    setHref((editor!.getAttributes('link').href as string | undefined) ?? '')
    setLinkError(null)
    setLinkOpen((open) => !open)
  }

  // Not a <form>: Puck wraps its whole field panel in one, so a nested form would
  // submit the outer one (and reload the editor) on Enter or Apply.
  function applyLink() {
    // With nothing selected and no link under the cursor, setLink would only
    // store a mark and the box would close as if it had worked.
    if (editor!.state.selection.empty && !editor!.isActive('link')) {
      setLinkError('Select the text you want to turn into a link first.')
      return
    }
    const next = normaliseHref(href)
    if (!next) {
      setLinkError('Enter a web address, like https://example.com, or an email address starting with mailto:')
      return
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: next }).run()
    closeLink()
  }

  function closeLink() {
    setLinkOpen(false)
    linkButton.current?.focus()
  }

  function removeLink() {
    editor!.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLink()
  }

  const inline = variant === 'inline'

  return (
    // `data-puck-rte-menu` tells Puck this is part of the editor's menu: without it,
    // moving focus into the menu (the link box, or Tab from the text) counts as
    // leaving the editor, and Puck ends the editing session.
    <div className={inline ? 'rt-inline' : 'rt-toolbar-wrap'} data-puck-rte-menu>
      <div className="rt-toolbar" role="group" aria-label="Text formatting">
        {inline ? (
          // A dropdown doesn't fit the canvas's small floating bar, so the two
          // heading levels are toggles there; switching one off gives a paragraph.
          <>
            <ToolButton
              label="Heading"
              text="H2"
              active={block === 'h2'}
              disabled={disabled}
              onClick={() => setBlock(block === 'h2' ? 'p' : 'h2')}
            />
            <ToolButton
              label="Subheading"
              text="H3"
              active={block === 'h3'}
              disabled={disabled}
              onClick={() => setBlock(block === 'h3' ? 'p' : 'h3')}
            />
          </>
        ) : (
          <select
            className="rt-block"
            aria-label="Text style"
            value={block}
            disabled={disabled}
            onChange={(event) => setBlock(event.target.value)}
          >
            <option value="p">Paragraph</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
          </select>
        )}
        <span className="rt-divider" aria-hidden="true" />
        <ToolButton
          label="Bold"
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"
        />
        <ToolButton
          label="Italic"
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon="M19 5h-9M14 19H5M15 5 9 19"
        />
        <span className="rt-divider" aria-hidden="true" />
        <ToolButton
          label="Bulleted list"
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"
        />
        <ToolButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M4 14.5a1.5 1.5 0 0 1 3 0c0 1-3 2-3 3.5h3"
        />
        <ToolButton
          label="Quote"
          active={editor.isActive('blockquote')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon="M6 17c0-4 1-7 4-9M14 17c0-4 1-7 4-9M6 13h4v4H6zM14 13h4v4h-4z"
        />
        <span className="rt-divider" aria-hidden="true" />
        <ToolButton
          label="Link"
          active={editor.isActive('link')}
          expanded={linkOpen}
          controls={linkBoxId}
          buttonRef={linkButton}
          disabled={disabled}
          onClick={openLink}
          icon="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
        />
      </div>
      {linkOpen && (
        <div className="rt-link" id={linkBoxId}>
          <label className="rt-link-label" htmlFor={linkInputId}>
            Link address
          </label>
          <div className="rt-link-row">
            <input
              id={linkInputId}
              className="rt-link-input"
              type="text"
              value={href}
              placeholder="https://example.com"
              autoFocus
              aria-invalid={linkError ? true : undefined}
              aria-describedby={linkError ? linkErrorId : undefined}
              onChange={(event) => {
                setHref(event.target.value)
                setLinkError(null)
              }}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyLink()
                } else if (event.key === 'Escape') {
                  closeLink()
                }
              }}
            />
            <button type="button" className="rt-link-apply" onClick={applyLink}>
              Apply
            </button>
            {editor.isActive('link') && (
              <button type="button" className="rt-link-remove" onClick={removeLink}>
                Remove
              </button>
            )}
          </div>
          {linkError && (
            <p id={linkErrorId} className="rt-link-error" role="alert">
              {linkError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ToolButton({
  label,
  active,
  expanded,
  controls,
  buttonRef,
  disabled,
  onClick,
  icon,
  text,
}: {
  label: string
  active: boolean
  expanded?: boolean
  controls?: string
  buttonRef?: Ref<HTMLButtonElement>
  disabled?: boolean
  onClick: () => void
  /** An SVG path for the icon, or `text` for a short word like "H2". */
  icon?: string
  text?: ReactNode
}) {
  return (
    <button
      type="button"
      className="rt-button"
      aria-label={label}
      title={label}
      ref={buttonRef}
      aria-pressed={active}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      disabled={disabled}
      // Keep the text selection: a button press would otherwise blur the editor first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={icon} />
        </svg>
      ) : (
        <span className="rt-button-text" aria-hidden="true">
          {text}
        </span>
      )}
    </button>
  )
}
