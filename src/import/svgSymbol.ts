// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright © 2026 Praharsh Nagpure — IPD Studio. Noncommercial use only;
// commercial use requires a paid license (see COMMERCIAL-LICENSE.md).

export class SvgImportError extends Error {}

const ALLOWED_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'g', 'text'])
const DROP_TAGS = new Set(['script', 'style', 'image', 'foreignobject', 'use', 'iframe', 'video', 'audio', 'animate'])
const MAX_MAJOR_PX = 96

export interface SanitizedSvg {
  svg: string
  gridSize: { w: number; h: number }
  warnings: string[]
}

/**
 * Sanitize + normalize a user-supplied SVG for use as a custom symbol:
 * keep plain drawable elements only, strip scripts/handlers/external refs,
 * rescale the drawing so its major side fits 96px, snap size to grid units,
 * and repaint strokes as currentColor so themes/exports stay monochrome.
 */
export function sanitizeSvg(raw: string): SanitizedSvg {
  const warnings: string[] = []
  const viewBoxMatch = /viewBox\s*=\s*"([\d.\s-]+)"/.exec(raw)
  const widthMatch = /<svg[^>]*\bwidth\s*=\s*"([\d.]+)/.exec(raw)
  const heightMatch = /<svg[^>]*\bheight\s*=\s*"([\d.]+)/.exec(raw)

  let vw = 0
  let vh = 0
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]!.trim().split(/\s+/).map(Number)
    vw = parts[2] ?? 0
    vh = parts[3] ?? 0
  } else if (widthMatch && heightMatch) {
    vw = Number(widthMatch[1])
    vh = Number(heightMatch[1])
  }
  if (!(vw > 0 && vh > 0)) {
    if (!/<svg/i.test(raw)) throw new SvgImportError('Not an SVG document')
    vw = 100
    vh = 100
    warnings.push('No viewBox/size found; assumed 100×100')
  }

  // Extract inner markup of the svg element.
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(raw)?.[1] ?? raw

  // Tokenize elements, keep allowlisted, drop everything else (with content for drop-tags).
  let cleaned = inner
  for (const tag of DROP_TAGS) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*\\/>`, 'gi')
    if (re.test(cleaned)) {
      warnings.push(`Removed <${tag}> content`)
      cleaned = cleaned.replace(re, '')
    }
  }
  // Remove any element not in the allowlist (self-closing or paired) conservatively.
  cleaned = cleaned.replace(/<\/?([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g, (m, tag: string, attrs: string, self: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    // strip event handlers, hrefs, classes, ids, styles
    let a = attrs
      .replace(/\son[\w-]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s(?:xlink:)?href\s*=\s*"[^"]*"/gi, '')
      .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
      .replace(/\s(?:class|id)\s*=\s*"[^"]*"/gi, '')
    // normalize paint: any explicit stroke becomes currentColor
    a = a.replace(/\sstroke\s*=\s*"(?!none")[^"]*"/gi, ' stroke="currentColor"')
    a = a.replace(/\sfill\s*=\s*"(?!none"|currentColor")[^"]*"/gi, ' fill="none"')
    if (m.startsWith('</')) return `</${t}>`
    return `<${t}${a}${self ? '/' : ''}>`
  })
  cleaned = cleaned.trim()
  if (!/<(path|rect|circle|ellipse|line|polyline|polygon)\b/i.test(cleaned)) {
    throw new SvgImportError('No drawable geometry left after sanitizing')
  }

  // Scale to fit MAX_MAJOR_PX, then snap size up to whole 8px grid units.
  const scale = MAX_MAJOR_PX / Math.max(vw, vh)
  const w = Math.max(1, Math.ceil((vw * scale) / 8))
  const h = Math.max(1, Math.ceil((vh * scale) / 8))
  const svg =
    scale === 1
      ? cleaned
      : `<g transform="scale(${Math.round(scale * 1000) / 1000})">${cleaned}</g>`

  return { svg, gridSize: { w, h }, warnings }
}
