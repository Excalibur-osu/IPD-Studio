import { useState } from 'react'
import { activeSheet, useStore } from '../store/store'
import { getSymbol } from '../symbols/registry'
import { askAi, readAiSettings, saveAiSettings, testAiConnection, type AiMessage, type AiSettings } from '../ai/client'
import type { AiOperation } from '../ai/types'

export default function AiPanel({ onClose }: { onClose: () => void }) {
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
      const result = await askAi(settings, doc, prompt, messages)
      setAnswer(result.answer); setOps(result.operations ?? [])
      setMessages((prev) => [...prev, { role: 'user', content: prompt }, { role: 'assistant', content: result.answer }])
    }
    catch (err) { setError(err instanceof Error ? err.message : '请求失败') }
    finally { setBusy(false) }
  }
  const testConnection = async () => {
    setTesting(true); setTestResult(''); saveAiSettings(settings)
    try { await testAiConnection(settings); setTestResult('连接成功') }
    catch (err) { setTestResult(err instanceof Error ? err.message : '连接失败') }
    finally { setTesting(false) }
  }
  const apply = (asCopy = false) => {
    const s = state()
    let applied = 0
    const idMap = new Map<string, string>()
    const edgeMap = new Map<string, string>()
    if (asCopy) {
      const copy = s.duplicateSheet(sheet.id, `${sheet.name} - AI方案`)
      if (!copy) { setError('无法创建方案副本'); return }
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
    setOps([]); setAnswer(`${answer}\n\n已应用 ${applied} 项修改${asCopy ? '到方案副本' : ''}。`)
  }

  return <div className="ai-overlay" onClick={onClose}>
    <section className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <header><strong>AI 工艺助手</strong><button onClick={onClose}>关闭</button></header>
      <div className="ai-settings">
        <label>Base URL<input value={settings.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} /></label>
        <label>API Key<input type="password" value={settings.apiKey} onChange={(e) => update({ apiKey: e.target.value })} /></label>
        <label>模型<input value={settings.model} onChange={(e) => update({ model: e.target.value })} /></label>
      </div>
      <div className="ai-connection"><button onClick={() => void testConnection()} disabled={testing}>{testing ? '测试中…' : '测试连接'}</button>{testResult && <span>{testResult}</span>}</div>
      <div className="ai-context">当前图纸：{doc.meta.name} · {sheet.nodes.length} 个设备 · {sheet.edges.length} 条管线</div>
      {messages.length > 0 && <div className="ai-history">{messages.map((message, i) => <div key={i} className={`ai-message ${message.role}`}><b>{message.role === 'user' ? '你' : 'AI'}</b><span>{message.content}</span></div>)}</div>}
      <textarea className="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入你要分析或修改的内容…" />
      {ops.length > 0 && <div className="ai-ops"><b>待应用修改（{ops.length}）</b>{ops.map((op, i) => <div key={i}>{operationLabel(op)}</div>)}</div>}
      <div className="ai-actions"><button onClick={() => void ask()} disabled={busy || !prompt.trim()}>{busy ? '请求中…' : '发送'}</button>{ops.length > 0 && <><button onClick={() => apply(false)}>应用到当前图纸</button><button onClick={() => apply(true)}>应用到方案副本</button></>}<button onClick={() => { setMessages([]); setAnswer(''); setOps([]); setError('') }}>清空会话</button></div>
      {error && <p className="ai-error">{error}</p>}
      {answer && <div className="ai-answer"><pre>{answer}</pre></div>}
      <small>模型仅能通过受控操作修改当前图纸。请复核所有工艺假设和现场确认项。</small>
    </section>
  </div>
}

function operationLabel(op: AiOperation): string {
  switch (op.type) {
    case 'setNodeTag': return `设置设备 ${op.nodeId} 位号`
    case 'setNodeLabel': return `设置设备 ${op.nodeId} 标签`
    case 'setNodePosition': return `调整设备 ${op.nodeId} 位置`
    case 'setNodeRotation': return `旋转设备 ${op.nodeId}`
    case 'setNodeConfig': return `修改设备 ${op.nodeId} 配置`
    case 'setEdgeArrow': return `修改管线 ${op.edgeId} 流向箭头`
    case 'setEdgeClass': return `修改管线 ${op.edgeId} 类别`
    case 'setPendingEndpointTag': return `设置管线 ${op.edgeId} 待接位号`
    case 'addNode': return `新增设备 ${op.symbolId}`
    case 'addEdge': return `新增 ${op.lineClass} 管线`
  }
}
