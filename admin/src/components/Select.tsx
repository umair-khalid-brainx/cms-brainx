import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { moveIndex, typeAheadIndex, type NavKey } from '../lib/menuKeys'
import { useAnchoredPopup } from '../lib/useAnchoredPopup'
import './Select.css'

export type SelectOption<T extends string> = { value: T; label: string; disabled?: boolean }

type SelectProps<T extends string> = {
  id?: string
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  disabled?: boolean
  className?: string
  /** Shown when `value` matches none of `options` — e.g. an action menu that leaves out the current choice. */
  placeholder?: string
  /** Names the control for screen readers when there is no visible <label for>. */
  'aria-label'?: string
  /** Ties the control to its hint or error text. */
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * A custom-styled dropdown, not a native <select>: the native popup is the OS's own and does not take this
 * app's themes. Keyboard follows the WAI-ARIA select-only combobox idea: Enter, Space or the arrows open it;
 * arrows, Home and End move; typing jumps; Enter or Space picks; Escape closes and keeps focus on the button.
 * The list opens in a layer of its own (ADM-03), so a table or card can never clip it.
 */
function Select<T extends string>({ id, value, onChange, options, disabled, className, placeholder, ...rest }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const [active, setActive] = useState(-1)
  const [portalTo, setPortalTo] = useState<Element>(document.body)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLElement | null)[]>([])
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()
  const { popupRef, style, placed } = useAnchoredPopup(open, () => setOpen(false), triggerRef, 'start')
  // Unavailable options stay focusable (aria-disabled) so a screen reader can read why; only picking them is refused.
  const noneDisabled = options.map(() => false)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (open && placed && active >= 0) optionRefs.current[active]?.focus()
  }, [open, placed, active])

  function openList() {
    setPortalTo(triggerRef.current?.closest('dialog') ?? document.body)
    setOpen(true)
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
  }

  function pick(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    setOpen(false)
    triggerRef.current?.focus()
    onChange(option.value)
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    }
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    const key = event.key
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault()
      setActive(moveIndex(key as NavKey, active, noneDisabled))
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      pick(active)
    } else if (key === 'Tab') {
      triggerRef.current?.focus()
      setOpen(false)
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = event.timeStamp
      typed.current = { text: now - typed.current.at > 700 ? key : typed.current.text + key, at: now }
      const next = typeAheadIndex(typed.current.text, active, options.map((option) => option.label), noneDisabled)
      if (next >= 0) setActive(next)
    }
  }

  return (
    <div className={`select-root${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest['aria-label'] ? `${rest['aria-label']}: ${selected?.label ?? placeholder ?? ''}` : undefined}
        aria-describedby={rest['aria-describedby']}
        aria-invalid={rest['aria-invalid']}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="select-value">{selected?.label ?? placeholder ?? ''}</span>
        <svg className="select-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <ul
            ref={popupRef as React.RefObject<HTMLUListElement>}
            id={listId}
            className="select-popup"
            role="listbox"
            aria-label={rest['aria-label']}
            style={style}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  tabIndex={index === active ? 0 : -1}
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  className={`select-option${option.value === value ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
                  onClick={() => pick(index)}
                >
                  {option.label}
                  {option.value === value && (
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="select-check">
                      <path d="m5 10.5 3.2 3.2L15 6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          // Inside a modal <dialog> (the page settings panel) the popup has to live in the dialog: the dialog's top layer
          // sits over <body>, so a popup in <body> would open behind it.
          portalTo,
        )}
    </div>
  )
}

export default Select
