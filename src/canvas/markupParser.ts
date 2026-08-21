/**
 * Minimal SVG-string -> JointJS MarkupJSON parser for the restricted subset
 * emitted by symbol renderers (path/circle/rect/polygon/line/text/g, double-
 * quoted attributes, optional text content). DOM-free so it runs in node.
 */
export interface MarkupNode {
  tagName: string
  selector?: string
  attributes?: Record<string, string>
  children?: (MarkupNode | string)[]
}

const TOKEN_RE = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/)?>|<\/([a-zA-Z][\w-]*)\s*>|([^<]+)/g
const ATTR_RE = /([\w:-]+)="([^"]*)"/g

export function parseSvgToMarkup(svg: string): (MarkupNode | string)[] {
  const root: (MarkupNode | string)[] = []
  const stack: MarkupNode[] = []
  const top = () => stack[stack.length - 1]
  const push = (child: MarkupNode | string) => {
    const parent = top()
    if (parent) (parent.children ??= []).push(child)
    else root.push(child)
  }

  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(svg)) !== null) {
    const [, open, attrStr, selfClose, close, text] = m
    if (open) {
      const attributes: Record<string, string> = {}
      let a: RegExpExecArray | null
      ATTR_RE.lastIndex = 0
      while ((a = ATTR_RE.exec(attrStr ?? '')) !== null) attributes[a[1]!] = a[2]!
      const node: MarkupNode = { tagName: open, attributes }
      push(node)
      if (!selfClose) stack.push(node)
    } else if (close) {
      const popped = stack.pop()
      if (!popped || popped.tagName !== close) throw new Error(`Mismatched </${close}> in symbol SVG`)
    } else if (text !== undefined) {
      const trimmed = text.trim()
      if (trimmed) push(trimmed)
    }
  }
  if (stack.length) throw new Error(`Unclosed <${top()!.tagName}> in symbol SVG`)
  return root
}
