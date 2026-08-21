import type { PlantEdge, ProjectDoc } from '../model/types'
import { isPortEnd } from '../model/types'
import { expandLetters, formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
import { useStore } from '../store/store'

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}
const row = (cells: string[]) => cells.map(csvField).join(',')

function nodeName(doc: ProjectDoc, nodeId: string): string {
  const node = doc.sheets.flatMap((sh) => sh.nodes).find((n) => n.id === nodeId)
  if (!node) return '?'
  if (node.tag) return formatTag(node.tag, '-')
  if (node.label) return node.label
  return getSymbol(node.symbolId).name
}

function endName(doc: ProjectDoc, end: PlantEdge['source']): string {
  return isPortEnd(end) ? nodeName(doc, end.nodeId) : 'free end'
}

export function instrumentIndexCsv(doc: ProjectDoc): string {
  const lines = [row(['Tag', 'Description', 'Loop', 'Symbol', 'Sheet', 'Connected To', 'Notes'])]
  for (const sheet of doc.sheets) {
    for (const node of sheet.nodes) {
      if (!node.tag?.letters) continue
      const connected = sheet.edges
        .flatMap((e) => {
          if (isPortEnd(e.source) && e.source.nodeId === node.id) return [endName(doc, e.target)]
          if (isPortEnd(e.target) && e.target.nodeId === node.id) return [endName(doc, e.source)]
          return []
        })
        .join('; ')
      lines.push(
        row([
          formatTag(node.tag, '-'),
          expandLetters(node.tag.letters),
          node.tag.loop,
          getSymbol(node.symbolId).name,
          sheet.name,
          connected,
          node.label ?? '',
        ]),
      )
    }
  }
  return lines.join('\n') + '\n'
}

export function lineListCsv(doc: ProjectDoc): string {
  const lines = [row(['Line Number', 'Class', 'Size', 'Spec', 'Service', 'Seq', 'Sheet', 'From', 'To'])]
  for (const sheet of doc.sheets) {
    for (const edge of sheet.edges) {
      const ln = edge.lineNumber
      if (!ln || !(ln.size || ln.spec || ln.service || ln.seq)) continue
      lines.push(
        row([
          [ln.size, ln.spec, ln.service, ln.seq].filter(Boolean).join('-'),
          edge.lineClass,
          ln.size,
          ln.spec,
          ln.service,
          ln.seq,
          sheet.name,
          endName(doc, edge.source),
          endName(doc, edge.target),
        ]),
      )
    }
  }
  return lines.join('\n') + '\n'
}

export function datasheetMatrixCsv(doc: ProjectDoc): string {
  const instruments = doc.sheets.flatMap((sh) => sh.nodes.filter((n) => n.kind === 'instrument'))
  const keys = [...new Set(instruments.flatMap((n) => Object.keys(n.datasheet ?? {})))].sort()
  const lines = [row(['Tag', 'Description', ...keys])]
  for (const node of instruments) {
    const tagText = node.tag ? formatTag(node.tag, '-') : ''
    lines.push(
      row([tagText, node.tag ? expandLetters(node.tag.letters) : '', ...keys.map((k) => node.datasheet?.[k] ?? '')]),
    )
  }
  return lines.join('\n') + '\n'
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadInstrumentIndex(): void {
  const doc = useStore.getState().doc
  download(`${doc.meta.name || 'diagram'}-instrument-index.csv`, instrumentIndexCsv(doc), 'text/csv')
}

export function downloadDatasheetMatrix(): void {
  const doc = useStore.getState().doc
  download(`${doc.meta.name || 'diagram'}-datasheets.csv`, datasheetMatrixCsv(doc), 'text/csv')
}

export function downloadLineList(): void {
  const doc = useStore.getState().doc
  download(`${doc.meta.name || 'diagram'}-line-list.csv`, lineListCsv(doc), 'text/csv')
}
