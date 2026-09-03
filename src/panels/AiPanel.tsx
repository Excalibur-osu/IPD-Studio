import { useState } from 'react'
import { activeSheet, useStore } from '../store/store'
import { getSymbol } from '../symbols/registry'
import { askAi, readAiSettings, saveAiSettings, testAiConnection, type AiMessage, type AiSettings } from '../ai/client'
import type { AiOperation } from '../ai/types'
import { useLanguage, useT } from '../i18n'

export default function AiPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useLanguage()
  const doc = useStore((s) => s.doc)
  const state = useStore.getState
  const [settings, setSettings] = useState<AiSettings>(readAiSettings)
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [ops, setOps] = useState<AiOperation[]>([])
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [error, setError] = useState('')
  const sheet = useStore((s) => activeSheet(s))

  const update = (patch: Partial<AiSettings>) => setSettings((prev) => ({ ...prev, ...patch }))
  const ask = async () => {
    setBusy(true); setError(''); setOps([]); saveAiSettings(settings)
    try {
      const result = await askAi(settings, doc, prompt, messages, lang)
      setAnswer(result.answer); setOps(result.operations ?? [])
      setMessages((prev) => [...prev, { role: 'user', content: prompt }, { role: 'assistant', content: result.answer }])
    }
    catch (err) { setError(err instanceof Error ? err.message : t('Request failed.')) }
    finally { setBusy(false) }
  }
  const testConnection = async () => {
    setTesting(true); setTestResult(''); saveAiSettings(settings)
    try { await testAiConnection(settings, lang); setTestResult(t('Connection successful.')) }
    catch (err) { setTestResult(err instanceof Error ? err.message : t('Connection failed.')) }
    finally { setTesting(false) }
  }
  const apply = (asCopy = false) => {
    const s = state()
    let applied = 0
    const idMap = new Map<string, string>()
    const edgeMap = new Map<string, string>()
    if (asCopy) {
      const copy = s.duplicateSheet(sheet.id, `${sheet.name} - ${t('AI option')}`)
      if (!copy) { setError(t('Could not create an option copy.')); return }
      for (const [from, to] of Object.entries(copy.nodeIdMap)) idMap.set(from, to)
      for (const [from, to] of Object.entries(copy.edgeIdMap)) edgeMap.set(from, to)
    }
    const resolveId = (id: string) => idMap.get(id) ?? id
    const resolveEdgeId = (id: string) => edgeMap.get(id) ?? id
    const targetSheet = () => activeSheet(useStore.getState())
    for (const op of ops) {
      try {
        const liveSheet = targetSheet()
        if (op.type === 'setNodeTag' && liveSheet.nodes.some((n) => n.id === resolveId(op.nodeId))) { s.setTag(resolveId(op.nodeId), op.tag ?? undefined); applied++ }
        else if (op.type === 'setNodeLabel' && liveSheet.nodes.some((n) => n.id === resolveId(op.nodeId))) { s.setLabel(resolveId(op.nodeId), op.label); applied++ }
        else if (op.type === 'setNodePosition' && liveSheet.nodes.some((n) => n.id === resolveId(op.nodeId))) { s.setNodePos(resolveId(op.nodeId), op.x, op.y); applied++ }
        else if (op.type === 'setNodeRotation' && liveSheet.nodes.some((n) => n.id === resolveId(op.nodeId))) {
          const node = liveSheet.nodes.find((n) => n.id === resolveId(op.nodeId))
          if (node) {
            const turns = ((op.rotation - node.rotation + 360) % 360) / 90
            for (let i = 0; i < turns; i++) s.rotateNode(node.id)
            applied++
          }
        }
        else if (op.type === 'setNodeConfig' && liveSheet.nodes.some((n) => n.id === resolveId(op.nodeId))) { s.setNodeConfig(resolveId(op.nodeId), op.config); applied++ }
        else if (op.type === 'setEdgeArrow' && liveSheet.edges.some((e) => e.id === resolveEdgeId(op.edgeId))) { s.setEdge(resolveEdgeId(op.edgeId), { arrow: op.arrow }); applied++ }
        else if (op.type === 'setEdgeClass' && liveSheet.edges.some((e) => e.id === resolveEdgeId(op.edgeId))) { s.setEdge(resolveEdgeId(op.edgeId), { lineClass: op.lineClass }); applied++ }
        else if (op.type === 'setPendingEndpointTag') {
          const edgeId = resolveEdgeId(op.edgeId)
          const edge = liveSheet.edges.find((e) => e.id === edgeId); const end = edge?.[op.end]
          if (edge && end && !('nodeId' in end)) { s.setEdge(edgeId, { [op.end]: op.tag ? { ...end, pendingTag: op.tag } : { x: end.x, y: end.y } }); applied++ }
        } else if (op.type === 'addNode') {
          getSymbol(op.symbolId)
          const actual = s.addNode({ ...op, rotation: op.rotation ?? 0 })
          if (op.clientId) idMap.set(op.clientId, actual)
          applied++
        }
        else if (op.type === 'addEdge') {
          const resolveEnd = (end: typeof op.source) => 'nodeId' in end ? { nodeId: resolveId(end.nodeId), portId: end.portId } : end
          s.addEdge({ ...op, source: resolveEnd(op.source), target: resolveEnd(op.target) }); applied++
        }
      } catch { /* invalid model operation is skipped */ }
    }
    setOps([])
    const summary = asCopy
      ? t('Applied {count} changes to the option copy.').replace('{count}', String(applied))
      : t('Applied {count} changes.').replace('{count}', String(applied))
    setAnswer(`${answer}\n\n${summary}`)
  }

  return <div className="ai-overlay" onClick={onClose}>
    <section className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <header><strong>{t('AI process assistant')}</strong><button onClick={onClose}>{t('Close')}</button></header>
      <div className="ai-settings">
        <label>{t('Base URL')}<input value={settings.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} /></label>
        <label>{t('API Key')}<input type="password" value={settings.apiKey} onChange={(e) => update({ apiKey: e.target.value })} /></label>
        <label>{t('Model')}<input value={settings.model} onChange={(e) => update({ model: e.target.value })} /></label>
      </div>
      <div className="ai-connection"><button onClick={() => void testConnection()} disabled={testing}>{testing ? t('Testing…') : t('Test connection')}</button>{testResult && <span>{testResult}</span>}</div>
      <div className="ai-context">{t('Current drawing')}: {doc.meta.name} · {sheet.nodes.length} {t(sheet.nodes.length === 1 ? 'device' : 'devices')} · {sheet.edges.length} {t(sheet.edges.length === 1 ? 'line' : 'lines')}</div>
      {messages.length > 0 && <div className="ai-history">{messages.map((message, i) => <div key={i} className={`ai-message ${message.role}`}><b>{message.role === 'user' ? t('You') : 'AI'}</b><span>{message.content}</span></div>)}</div>}
      <textarea className="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('Describe what you want to analyze or change…')} />
      {ops.length > 0 && <div className="ai-ops"><b>{t('Pending changes')} ({ops.length})</b>{ops.map((op, i) => <div key={i}>{operationLabel(op, t)}</div>)}</div>}
      <div className="ai-actions"><button onClick={() => void ask()} disabled={busy || !prompt.trim()}>{busy ? t('Requesting…') : t('Send')}</button>{ops.length > 0 && <><button onClick={() => apply(false)}>{t('Apply to current drawing')}</button><button onClick={() => apply(true)}>{t('Apply to option copy')}</button></>}<button onClick={() => { setMessages([]); setAnswer(''); setOps([]); setError(''); setTestResult('') }}>{t('Clear conversation')}</button></div>
      {error && <p className="ai-error">{error}</p>}
      {answer && <div className="ai-answer"><pre>{answer}</pre></div>}
      <small>{t('The model can modify the drawing only through controlled operations. Review every process assumption and site confirmation item.')}</small>
    </section>
  </div>
}

function operationLabel(op: AiOperation, t: (text: string) => string): string {
  switch (op.type) {
    case 'setNodeTag': return `${t('Set device tag')}: ${op.nodeId}`
    case 'setNodeLabel': return `${t('Set device label')}: ${op.nodeId}`
    case 'setNodePosition': return `${t('Move device')}: ${op.nodeId}`
    case 'setNodeRotation': return `${t('Rotate device')}: ${op.nodeId}`
    case 'setNodeConfig': return `${t('Change device configuration')}: ${op.nodeId}`
    case 'setEdgeArrow': return `${t('Change line flow arrow')}: ${op.edgeId}`
    case 'setEdgeClass': return `${t('Change line class')}: ${op.edgeId}`
    case 'setPendingEndpointTag': return `${t('Set pending endpoint tag')}: ${op.edgeId}`
    case 'addNode': return `${t('Add device')}: ${op.symbolId}`
    case 'addEdge': return `${t('Add line')}: ${op.lineClass}`
  }
}
