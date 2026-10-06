import { useEffect, useRef, useState } from 'react'
import './Select.css'

export type SelectOption<T extends string> = { value: T; label: string }

type SelectProps<T extends string> = {
  id?: string
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  disabled?: boolean
  className?: string
  /** Shown when `value` matches none of `options` — e.g. an action menu that leaves out the current choice. */
  placeholder?: string
}

/**
 * A custom-styled dropdown, not a native <select> — native selects render
 * with the OS's own popup and arrow, which doesn't take this app's dark
 * theme and looked visibly wrong (a plain white browser popup, default arrow
 * glued to the box's right edge with no matching padding to the rest of the
 * UI). This owns its own popup and arrow instead.
 */
function Select<T extends string>({ id, value, onChange, options, disabled, className, placeholder }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function selectOption(option: SelectOption<T>) {
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div className={`select-root${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="select-value">{selected?.label ?? placeholder ?? ''}</span>
        <svg className="select-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="select-popup" role="listbox">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`select-option${option.value === value ? ' is-selected' : ''}`}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
