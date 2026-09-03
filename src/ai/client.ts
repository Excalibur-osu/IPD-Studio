import type { ProjectDoc } from '../model/types'
import type { Language } from '../i18n'
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

const AI_TEXT = {
  en: {
    baseUrl: 'Enter the Base URL first.',
    apiKey: 'Enter the API key first.',
    model: 'Enter the model name first.',
    requestFailed: (status: number) => `Model request failed (${status}).`,
    noContent: 'The model returned no content.',
    invalidJson: 'The model did not return valid JSON.',
    invalidReply: 'The model returned an invalid response format.',
    connectionFailed: (status: number) => `Connection failed (${status}).`,
  },
  'zh-CN': {
    baseUrl: '请先填写 Base URL。',
    apiKey: '请先填写 API Key。',
    model: '请先填写模型名称。',
    requestFailed: (status: number) => `模型请求失败（${status}）。`,
    noContent: '模型没有返回内容。',
    invalidJson: '模型未返回有效的 JSON。',
    invalidReply: '模型返回格式无效。',
    connectionFailed: (status: number) => `连接失败（${status}）。`,
  },
} as const

export function buildAiSystemPrompt(doc: ProjectDoc, lang: Language): string {
  const context = JSON.stringify(doc)
  if (lang === 'zh-CN') {
    return `你是 P&ID 工艺流程图助手。你可以分析用户提供的图纸 JSON，并提出或执行受控修改。使用简体中文回答。只输出 JSON，不要 Markdown，格式为 {"answer":"中文回答","operations":[]}。operations 只能使用 setNodeTag、setNodeLabel、setNodePosition、setNodeRotation、setNodeConfig、setEdgeArrow、setEdgeClass、setPendingEndpointTag、addNode、addEdge。所有已有对象 ID 必须来自图纸，新增设备必须使用已有 symbolId；新增设备如需被新增管线引用，请给 addNode 一个唯一 clientId，并在 addEdge 中使用该 clientId。不要臆造工艺事实；把假设和现场确认项写进 answer。当前图纸 JSON：${context}`
  }
  return `You are a P&ID process engineering assistant. You can analyze the supplied drawing JSON and propose or perform controlled changes. Answer in English. Output JSON only, without Markdown, in the form {"answer":"English answer","operations":[]}. operations may only use setNodeTag, setNodeLabel, setNodePosition, setNodeRotation, setNodeConfig, setEdgeArrow, setEdgeClass, setPendingEndpointTag, addNode, and addEdge. Every existing object ID must come from the drawing. A new device must use an existing symbolId. If a new line refers to a newly added device, give addNode a unique clientId and use that clientId in addEdge. Do not invent process facts; state assumptions and items requiring site confirmation in answer. Current drawing JSON: ${context}`
}

export async function askAi(settings: AiSettings, doc: ProjectDoc, prompt: string, history: AiMessage[] = [], lang: Language = 'en'): Promise<AiReply> {
  const copy = AI_TEXT[lang]
  if (!settings.baseUrl.trim()) throw new Error(copy.baseUrl)
  if (!settings.apiKey.trim()) throw new Error(copy.apiKey)
  if (!settings.model.trim()) throw new Error(copy.model)
  const system = buildAiSystemPrompt(doc, lang)
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
  if (!response.ok) throw new Error(copy.requestFailed(response.status))
  const body = await response.json() as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error(copy.noContent)
  const json = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: AiReply
  try { parsed = JSON.parse(json) as AiReply }
  catch { throw new Error(copy.invalidJson) }
  if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.operations ?? [])) throw new Error(copy.invalidReply)
  return parsed
}

export async function testAiConnection(settings: AiSettings, lang: Language = 'en'): Promise<void> {
  const copy = AI_TEXT[lang]
  if (!settings.baseUrl.trim()) throw new Error(copy.baseUrl)
  if (!settings.apiKey.trim()) throw new Error(copy.apiKey)
  const response = await fetch(`${settings.baseUrl.trim().replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
  })
  if (!response.ok) throw new Error(copy.connectionFailed(response.status))
}
