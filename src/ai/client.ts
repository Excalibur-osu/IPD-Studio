import type { ProjectDoc } from '../model/types'
import type { AiReply } from './types'

export interface AiSettings { baseUrl: string; apiKey: string; model: string }
export interface AiMessage { role: 'user' | 'assistant'; content: string }
const KEY = 'pid.ai.settings'

export function readAiSettings(): AiSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '') as Partial<AiSettings>
    const baseUrl = saved.baseUrl === 'https://api.openai.com/v1' && !saved.apiKey ? '' : (saved.baseUrl ?? '')
    const model = saved.model === 'gpt-4o-mini' && !saved.apiKey ? '' : (saved.model ?? '')
    return { baseUrl, apiKey: saved.apiKey ?? '', model }
  } catch {
    return { baseUrl: '', apiKey: '', model: '' }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* private mode */ }
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
}

export async function askAi(settings: AiSettings, doc: ProjectDoc, prompt: string, history: AiMessage[] = []): Promise<AiReply> {
  if (!settings.baseUrl.trim()) throw new Error('请先填写 Base URL')
  if (!settings.apiKey.trim()) throw new Error('请先填写 API Key')
  if (!settings.model.trim()) throw new Error('请先填写模型名称')
  const context = JSON.stringify(doc)
  const system = `你是 P&ID 工艺流程图助手。你可以分析用户提供的图纸 JSON，并提出或执行受控修改。只输出 JSON，不要 Markdown，格式为 {"answer":"中文回答","operations":[]}。operations 只能使用 setNodeTag、setNodeLabel、setNodePosition、setNodeRotation、setNodeConfig、setEdgeArrow、setEdgeClass、setPendingEndpointTag、addNode、addEdge。所有已有对象 ID 必须来自图纸，新增设备必须使用已有 symbolId；新增设备如需被新增管线引用，请给 addNode 一个唯一 clientId，并在 addEdge 中使用该 clientId。不要臆造工艺事实；把假设和现场确认项写进 answer。当前图纸 JSON：${context}`
  const messages = [
    { role: 'system' as const, content: system },
    ...history.slice(-12),
    { role: 'user' as const, content: prompt },
  ]
  const response = await fetch(endpoint(settings.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey.trim()}` },
    body: JSON.stringify({ model: settings.model.trim(), temperature: 0.2, messages }),
  })
  if (!response.ok) throw new Error(`模型请求失败 (${response.status})`)
  const body = await response.json() as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('模型没有返回内容')
  const json = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(json) as AiReply
  if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.operations ?? [])) throw new Error('模型返回格式无效')
  return parsed
}

export async function testAiConnection(settings: AiSettings): Promise<void> {
  if (!settings.baseUrl.trim()) throw new Error('请先填写 Base URL')
  if (!settings.apiKey.trim()) throw new Error('请先填写 API Key')
  const response = await fetch(`${settings.baseUrl.trim().replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
  })
  if (!response.ok) throw new Error(`连接失败 (${response.status})`)
}
