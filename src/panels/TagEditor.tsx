import { useMemo } from 'react'
import { expandLetters, validateLetters } from '../isa/tag'
import { isDuplicateTag, nextLoopNumber } from '../isa/autonumber'
import { useStore } from '../store/store'
import type { PlantNode } from '../model/types'

export default function TagEditor({ node }: { node: PlantNode }) {
  const setTag = useStore((s) => s.setTag)
  const doc = useStore((s) => s.doc)
  const tag = node.tag ?? { letters: '', loop: '' }

  const validation = useMemo(() => (tag.letters ? validateLetters(tag.letters) : null), [tag.letters])
  const expansion = useMemo(() => (tag.letters ? expandLetters(tag.letters) : ''), [tag.letters])
  const duplicate = useMemo(
    () => (tag.letters && tag.loop ? isDuplicateTag(doc, tag, node.id) : false),
    [doc, tag, node.id],
  )

  const update = (patch: Partial<typeof tag>) => {
    const next = { ...tag, ...patch }
    if (!next.letters && !next.loop) setTag(node.id, undefined)
    else setTag(node.id, { letters: next.letters, loop: next.loop, ...(next.suffix ? { suffix: next.suffix } : {}) })
  }

  return (
    <div className="prop-group">
      <div className="prop-title">ISA Tag</div>
      <div className="tag-row">
        <input
          className="tag-letters"
          placeholder="FIC"
          value={tag.letters}
          maxLength={5}
          onChange={(e) => update({ letters: e.target.value.toUpperCase() })}
        />
        <span>–</span>
        <input
          className="tag-loop"
          placeholder="101"
          value={tag.loop}
          maxLength={6}
          onChange={(e) => update({ loop: e.target.value.replace(/\D/g, '') })}
        />
        <input
          className="tag-suffix"
          placeholder=""
          value={tag.suffix ?? ''}
          maxLength={1}
          onChange={(e) => update({ suffix: e.target.value.toUpperCase() || undefined })}
        />
        <button
          className="tag-auto"
          title="Next free loop number"
          onClick={() => update({ loop: nextLoopNumber(doc, tag.letters || 'X') })}
        >
          №
        </button>
      </div>
      {expansion && <div className="tag-expansion">{expansion}</div>}
      {validation && !validation.ok && <div className="tag-error">{validation.reason}</div>}
      {duplicate && <div className="tag-error">Duplicate tag in this drawing</div>}
    </div>
  )
}
