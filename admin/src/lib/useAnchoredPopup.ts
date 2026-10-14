import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { placePopup, type Placement } from './menuKeys'

/**
 * Positions a popup next to its trigger in a layer of its own (a portal into <body>), so no table, card or
 * overflow:hidden parent can clip it, and flips it above the trigger near the bottom edge (ADM-03). Closes on an
 * outside press, on Escape (giving focus back to the trigger) and when the page scrolls or resizes under it.
 */
export function useAnchoredPopup(open: boolean, close: () => void, triggerRef: RefObject<HTMLElement | null>, align: 'start' | 'end' = 'start') {
  const popupRef = useRef<HTMLElement | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  const measure = useCallback(() => {
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!trigger || !popup) return
    const t = trigger.getBoundingClientRect()
    // scrollHeight, not offsetHeight: the popup may already be capped by a previous max-height.
    setPlacement(placePopup(t, { width: popup.offsetWidth, height: popup.scrollHeight }, { width: window.innerWidth, height: window.innerHeight }, align))
  }, [triggerRef, align])

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent) => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      closeRef.current()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      // Inside a modal <dialog> (page settings) Escape would otherwise close the dialog as well as the popup.
      event.preventDefault()
      closeRef.current()
      triggerRef.current?.focus()
    }
    // A scroll inside the popup's own list is fine; any other scroll or a resize would leave it adrift.
    const scroll = (event: Event) => {
      if (popupRef.current && event.target instanceof Node && popupRef.current.contains(event.target)) return
      closeRef.current()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key, true)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', measure)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, triggerRef, measure])

  const style = open && placement
    ? { position: 'fixed' as const, top: placement.top, left: placement.left, minWidth: placement.minWidth, maxHeight: placement.maxHeight }
    : { position: 'fixed' as const, top: 0, left: 0, visibility: 'hidden' as const }
  return { popupRef, style, up: open && (placement?.up ?? false), placed: open && placement !== null }
}
