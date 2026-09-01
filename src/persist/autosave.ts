// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

import { get, set } from 'idb-keyval'
import type { ProjectDoc } from '../model/types'
import { loadDoc } from '../model/migrate'
import { useStore } from '../store/store'

const KEY = 'pid-studio.autosave'
const HISTORY_KEY = 'pid-studio.history'
const HISTORY_MAX = 10
/** A new history slot no more often than every 2 minutes of editing. */
const HISTORY_BUCKET_MS = 2 * 60_000
let timer: ReturnType<typeof setTimeout> | null = null

export interface Snapshot {
  ts: number
  name: string
  doc: unknown
}

async function pushHistory(doc: ProjectDoc): Promise<void> {
  try {
    const list = ((await get(HISTORY_KEY)) as Snapshot[] | undefined) ?? []
    const snap: Snapshot = { ts: Date.now(), name: doc.meta.name || 'Untitled', doc: JSON.parse(JSON.stringify(doc)) }
    const last = list[list.length - 1]
    const next =
      last && snap.ts - last.ts < HISTORY_BUCKET_MS && last.name === snap.name
        ? [...list.slice(0, -1), snap] // refresh the current bucket
        : [...list.slice(-(HISTORY_MAX - 1)), snap]
    await set(HISTORY_KEY, next)
  } catch {
    /* history is best-effort */
  }
}

export async function listHistory(): Promise<Snapshot[]> {
  try {
    return (((await get(HISTORY_KEY)) as Snapshot[] | undefined) ?? []).slice().reverse()
  } catch {
    return []
  }
}

export function restoreSnapshot(snap: Snapshot): void {
  useStore.getState().loadIntoStore(loadDoc(snap.doc))
}

export function startAutosave(): () => void {
  let prev = useStore.getState().doc
  const unsub = useStore.subscribe((s) => {
    if (s.doc === prev) return
    prev = s.doc
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void set(KEY, JSON.parse(JSON.stringify(s.doc)))
      void pushHistory(s.doc)
    }, 500)
  })
  return () => {
    unsub()
    if (timer) clearTimeout(timer)
  }
}

export async function restoreAutosave(): Promise<ProjectDoc | null> {
  try {
    const raw = await get(KEY)
    if (!raw) return null
    const doc = loadDoc(raw)
    const hasContent =
      doc.sheets.some((sh) => sh.nodes.length || sh.edges.length) ||
      doc.hmiScreens.some((sc) => sc.widgets.length || sc.pipes.length)
    return hasContent ? doc : null
  } catch {
    return null
  }
}
