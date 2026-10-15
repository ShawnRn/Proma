import { describe, expect, test } from 'bun:test'
import { createAssistantMessageEventStream, normalizeContext } from '@earendil-works/pi-ai'
import type { Api, AssistantMessage, Model } from '@earendil-works/pi-ai'
import type { StreamFn } from '@earendil-works/pi-agent-core'
import type { SDKResultMessage } from '@proma/shared'
import { convertResultMessage } from './pi-message-adapter'
import { getPiMessagePerformance, withPiInferencePerformance } from './pi-inference-performance'

const model = { id: 'qwen3.5', api: 'openai-completions' } as Model<Api>

describe('Pi 推理统计链路', () => {
  const request: StreamFn = (_model, _context, options) => {
    const stream = createAssistantMessageEventStream()
    void (async () => {
      const response = await options!.fetch!('http://localhost:11434/v1/chat/completions', { signal: options?.signal })
      await response.text()
      const message = {
        role: 'assistant', content: [{ type: 'text', text: '你好' }], stopReason: options?.signal?.aborted ? 'aborted' : 'stop',
        usage: { input: 100, output: 60, cacheRead: 0, cacheWrite: 0 },
      } as AssistantMessage
      stream.push({ type: 'done', reason: 'stop', message })
    })()
    return stream
  }
  const response = (tokens: number): Response => new Response(`data: {"timings":{"predicted_n":${tokens},"predicted_ms":1000}}\n\ndata: [DONE]\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })

  test('Given 两个并发会话 When Pi 完成 Then 速度互不串线并写入可恢复的 result', async () => {
    const run = withPiInferencePerformance(request)
    const [first, second] = await Promise.all([
      run(model, normalizeContext({ messages: [] }), { fetch: (async () => response(60)) as unknown as typeof fetch }),
      run(model, normalizeContext({ messages: [] }), { fetch: (async () => response(20)) as unknown as typeof fetch }),
    ])
    const messages = await Promise.all([first.result(), second.result()])
    expect(getPiMessagePerformance(messages[0]!)?.outputTokens).toBe(60)
    expect(getPiMessagePerformance(messages[1]!)?.outputTokens).toBe(20)
    const result = convertResultMessage(messages, 'session') as SDKResultMessage
    expect(JSON.parse(JSON.stringify(result)).performance).toEqual({ outputTokens: 80, outputDurationMs: 2000 })
  })

  test('Given 用户中止 When Pi 返回残片 Then 不记录完整回复的平均速度', async () => {
    const controller = new AbortController()
    controller.abort()
    const stream = await withPiInferencePerformance(request)(model, normalizeContext({ messages: [] }), {
      signal: controller.signal, fetch: (async () => response(20)) as unknown as typeof fetch,
    })
    expect(getPiMessagePerformance(await stream.result())).toBeUndefined()
  })
})
