import { get, set } from 'idb-keyval'
import type { ProjectDoc } from '../model/types'
import { loadDoc } from '../model/migrate'
import { useStore } from '../store/store'

const KEY = 'pid-studio.autosave'
let timer: ReturnType<typeof setTimeout> | null = null

export function startAutosave(): () => void {
  let prev = useStore.getState().doc
  const unsub = useStore.subscribe((s) => {
    if (s.doc === prev) return
    prev = s.doc
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void set(KEY, JSON.parse(JSON.stringify(s.doc)))
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
    return doc.sheets.some((sh) => sh.nodes.length || sh.edges.length) ? doc : null
  } catch {
    return null
  }
}
