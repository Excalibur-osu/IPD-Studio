// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * A menu anchored to a toolbar button, rendered into <body>.
 *
 * It has to escape the toolbar: that row scrolls horizontally, and a scroll
 * container clips absolutely-positioned descendants — which silently swallowed
 * both the Export and account menus. Portalling out and positioning `fixed`
 * against the trigger's rect keeps the row scrollable and the menus visible.
 *
 * Dismissal lives here rather than in each caller, because once the menu is in
 * a portal it is no longer inside the trigger's subtree: a caller checking
 * `root.contains(target)` would treat its own menu items as outside clicks and
 * close before the click landed.
 */
export default function Popover({
  anchor,
  onClose,
  className,
  role = 'menu',
  testId,
  children,
}: {
  anchor: RefObject<HTMLElement | null>
  onClose(): void
  className?: string
  role?: string
  testId?: string
  children: ReactNode
}) {
  const selfRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 4
      setPos({
        top: r.bottom + gap,
        // anchored by its right edge, so the width never has to be measured
        right: Math.max(8, window.innerWidth - r.right),
        // a long menu on a short window scrolls itself instead of running off
        maxHeight: Math.max(160, window.innerHeight - r.bottom - gap - 12),
      })
    }
    place()
    window.addEventListener('resize', place)
    // capture phase, so scrolling the toolbar itself re-anchors the menu too
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (selfRef.current?.contains(t) || anchor.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  if (!pos) return null

  return createPortal(
    <div
      ref={selfRef}
      className={className}
      role={role}
      data-testid={testId}
      style={{ position: 'fixed', top: pos.top, right: pos.right, maxHeight: pos.maxHeight, overflowY: 'auto' }}
    >
      {children}
    </div>,
    document.body,
  )
}
