import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '../lib/siteRouter'
import { moveIndex, typeAheadIndex, type NavKey } from '../lib/menuKeys'
import { useAnchoredPopup } from '../lib/useAnchoredPopup'
import './Menu.css'

export type MenuItem = {
  id: string
  label: string
  /** A link (opens in the same tab unless `external`) or an action; give one of them. */
  href?: string
  external?: boolean
  onSelect?: () => void
  /** A destructive action: shown in the danger colour. */
  danger?: boolean
  disabled?: boolean
  /** Shown under a disabled item so people can see why it is off. */
  disabledReason?: string
  /** A line above this item, to set a group apart. */
  separatorBefore?: boolean
}

type MenuProps = {
  /** What the button is for, read by screen readers ("Actions for About us"). */
  label: string
  items: MenuItem[]
  /** The button's content; the default is a three-dot icon. */
  children?: ReactNode
  className?: string
  align?: 'start' | 'end'
  disabled?: boolean
}

/**
 * One menu used everywhere (ADM-03): a button that opens a list of actions. Follows the WAI-ARIA menu button
 * pattern: Enter, Space or the arrows open it; the arrows, Home and End move; typing a letter jumps; Escape
 * closes and returns focus to the button; Tab closes. Opens in a layer of its own so tables cannot clip it.
 */
export default function Menu({ label, items, children, className, align = 'end', disabled }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const typed = useRef({ text: '', at: 0 })
  const menuId = useId()
  const close = () => setOpen(false)
  const { popupRef, style, up, placed } = useAnchoredPopup(open, close, triggerRef, align)
  const isDisabled = items.map((item) => !!item.disabled)

  // Focus follows `active` while open.
  useEffect(() => {
    if (open && placed && active >= 0) itemRefs.current[active]?.focus()
  }, [open, placed, active])

  function openAt(index: 'first' | 'last') {
    setOpen(true)
    setActive(index === 'first' ? moveIndex('Home', -1, isDisabled) : moveIndex('End', -1, isDisabled))
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAt('first')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt('last')
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const key = event.key
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault()
      setActive(moveIndex(key as NavKey, active, isDisabled))
    } else if (key === 'Tab') {
      // The list is in <body>; hand focus back to the button so the native Tab carries on from there.
      triggerRef.current?.focus()
      close()
    } else if (key === ' ' && event.target instanceof HTMLAnchorElement) {
      // A link ignores Space; the menu pattern wants it to activate.
      event.preventDefault()
      event.target.click()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && key !== ' ') {
      const now = event.timeStamp
      typed.current = { text: now - typed.current.at > 700 ? key : typed.current.text + key, at: now }
      const next = typeAheadIndex(typed.current.text, active, items.map((item) => item.label), isDisabled)
      if (next >= 0) setActive(next)
    }
  }

  function choose(item: MenuItem) {
    if (item.disabled) return
    close()
    triggerRef.current?.focus()
    item.onSelect?.()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-menu-trigger${children ? '' : ' is-icon'}${className ? ` ${className}` : ''}`}
        aria-label={children ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => {
          if (open) close()
          else openAt('first')
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {children ?? (
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="4.5" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="15.5" cy="10" r="1.5" />
          </svg>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef as React.RefObject<HTMLDivElement>}
            id={menuId}
            role="menu"
            aria-label={label}
            className={`ui-menu${up ? ' is-up' : ''}`}
            style={style}
            onKeyDown={onMenuKeyDown}
          >
            {items.map((item, index) => {
              const common = {
                role: 'menuitem' as const,
                tabIndex: index === active ? 0 : -1,
                'aria-disabled': item.disabled || undefined,
                className: `ui-menu-item${item.danger ? ' is-danger' : ''}${item.disabled ? ' is-disabled' : ''}`,
                ref: (node: HTMLElement | null) => {
                  itemRefs.current[index] = node
                },
              }
              const body = (
                <>
                  <span>{item.label}</span>
                  {item.disabled && item.disabledReason && <span className="ui-menu-reason">{item.disabledReason}</span>}
                </>
              )
              return (
                <div key={item.id} className="ui-menu-row" role="none">
                  {item.separatorBefore && <div className="ui-menu-separator" role="separator" />}
                  {item.href && !item.disabled ? (
                    item.external ? (
                      <a {...common} href={item.href} target="_blank" rel="noreferrer" onClick={close}>
                        {body}
                      </a>
                    ) : (
                      <Link {...common} to={item.href} onClick={close}>
                        {body}
                      </Link>
                    )
                  ) : (
                    <button {...common} type="button" onClick={() => choose(item)}>
                      {body}
                    </button>
                  )}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
