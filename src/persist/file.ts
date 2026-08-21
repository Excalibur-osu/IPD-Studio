import type { ProjectDoc } from '../model/types'
import { loadDoc } from '../model/migrate'
import { useStore } from '../store/store'

export function serializeDoc(doc: ProjectDoc): string {
  return JSON.stringify(doc, null, 2)
}

export function deserializeDoc(json: string): ProjectDoc {
  return loadDoc(JSON.parse(json))
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]>
}

const PICKER_TYPES = [{ description: 'PID Studio drawing', accept: { 'application/json': ['.pnid.json'] } }]

export async function saveFile(): Promise<void> {
  const { doc, markSaved } = useStore.getState()
  const json = serializeDoc(doc)
  const w = window as FilePickerWindow
  const suggested = `${(doc.meta.name || 'diagram').replace(/[^\w-]+/g, '-')}.pnid.json`
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: suggested, types: PICKER_TYPES })
      const writable = await (handle as unknown as { createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }).createWritable()
      await writable.write(json)
      await writable.close()
      markSaved()
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // fall through to download
    }
  }
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = suggested
  a.click()
  URL.revokeObjectURL(a.href)
  markSaved()
}

export async function openFile(): Promise<void> {
  const w = window as FilePickerWindow
  const loadText = (text: string) => useStore.getState().loadIntoStore(deserializeDoc(text))
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: PICKER_TYPES })
      if (!handle) return
      const file = await handle.getFile()
      loadText(await file.text())
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      throw err
    }
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) loadText(await file.text())
  }
  input.click()
}
