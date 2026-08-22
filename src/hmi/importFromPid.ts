import type { PlantNode, Sheet } from '../model/types'
import type { HmiWidget, WidgetType } from './model'
import { WIDGET_DEFAULT_SIZE } from './model'
import { formatTag } from '../isa/tag'
import { getSymbol } from '../symbols/registry'
// side-effect: fill the symbol registry (same import the catalog tests use)
import '../symbols/lib/index'

export interface ImportCtx { nameOf: Map<string, string> }

const AUTO_PREFIX: Partial<Record<WidgetType, string>> = {
  tank: 'TK', pump: 'P', valve: 'V', display: 'XI', symbol: 'X',
}

function categoryOf(node: PlantNode): string {
  try { return getSymbol(node.symbolId).category } catch { return 'custom' }
}

function widgetTypeFor(node: PlantNode, category: string): { type: WidgetType; props: HmiWidget['props'] } | null {
  if (node.kind === 'annotation') return null
  const letters = node.tag?.letters ?? ''
  if (node.kind === 'equipment' && category === 'vessels') return { type: 'tank', props: undefined }
  if (category === 'rotating') return { type: 'pump', props: undefined }
  if (category === 'control-valves') return { type: 'valve', props: { throttle: true } }
  if (category === 'safety') return { type: 'symbol', props: { symbolId: node.symbolId } }
  if (node.kind === 'valve') return { type: 'valve', props: undefined }
  if (node.kind === 'instrument') {
    if (letters.endsWith('T')) return { type: 'display', props: undefined }
    if (letters.includes('C') && !letters.endsWith('V')) return { type: 'display', props: { controller: true } }
    return { type: 'display', props: undefined }
  }
  return { type: 'symbol', props: { symbolId: node.symbolId } }
}

/** Map a sheet's nodes to HMI widgets (positions raw; importSheet rescales). */
export function mapNodes(sheet: Sheet, separator: '-' | ''): { widgets: HmiWidget[]; ctx: ImportCtx } {
  const widgets: HmiWidget[] = []
  const nameOf = new Map<string, string>()
  const counters = new Map<string, number>()
  const used = new Set<string>()

  for (const node of sheet.nodes) {
    const category = categoryOf(node)
    const mapped = widgetTypeFor(node, category)
    if (!mapped) continue
    let name = node.tag ? formatTag(node.tag, separator) : (node.label?.trim() || '')
    if (!name || used.has(name)) {
      const prefix = AUTO_PREFIX[mapped.type] ?? 'X'
      let n = (counters.get(prefix) ?? 0) + 1
      while (used.has(`${prefix}-${n}`)) n++
      counters.set(prefix, n)
      name = `${prefix}-${n}`
    }
    used.add(name)
    nameOf.set(node.id, name)

    let w: number, h: number
    if (mapped.type === 'display') {
      ;({ w, h } = WIDGET_DEFAULT_SIZE.display)
    } else {
      const scale = node.scale ?? 1
      try {
        const g = getSymbol(node.symbolId).gridSize
        w = g.w * 8 * scale
        h = g.h * 8 * scale
      } catch {
        ;({ w, h } = WIDGET_DEFAULT_SIZE[mapped.type])
      }
      if (mapped.type === 'tank') { w = Math.max(w, 64); h = Math.max(h, 80) }
    }
    widgets.push({
      id: `imp-${node.id}`,
      type: mapped.type, x: node.x, y: node.y, w, h,
      tag: name, label: node.label, props: mapped.props,
    })
  }
  return { widgets, ctx: { nameOf } }
}
