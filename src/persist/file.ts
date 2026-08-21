import type { ProjectDoc } from '../model/types'
import { loadDoc } from '../model/migrate'
import { createEmptyDoc } from '../model/doc'
import { importDexpi } from '../import/dexpi'
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

const PICKER_TYPES = [
  { description: 'PID Studio drawing', accept: { 'application/json': ['.pnid.json'] } },
  { description: 'DEXPI / Proteus XML', accept: { 'application/xml': ['.xml'] } },
]

function loadAnyText(name: string, text: string): void {
  if (name.endsWith('.xml') || text.trimStart().startsWith('<?xml') || text.includes('<PlantModel')) {
    const { sheet, warnings } = importDexpi(text)
    const doc = createEmptyDoc(sheet.name || name.replace(/\.[^.]+$/, ''))
    doc.sheets = [sheet]
    useStore.getState().loadIntoStore(doc)
    if (warnings.length) window.alert(`DEXPI import finished with warnings:\n${warnings.join('\n')}`)
    return
  }
  useStore.getState().loadIntoStore(deserializeDoc(text))
}

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
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: PICKER_TYPES })
      if (!handle) return
      const file = await handle.getFile()
      loadAnyText(file.name, await file.text())
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      throw err
    }
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.xml,application/json,application/xml'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) loadAnyText(file.name, await file.text())
  }
  input.click()
}
