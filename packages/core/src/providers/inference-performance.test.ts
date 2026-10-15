import { describe, expect, test } from 'bun:test'
import { tokensPerSecond, sumInferencePerformance } from '@proma/shared'
import type { InferencePerformance } from '@proma/shared'
import { InferencePerformanceTracker, observeInferencePerformance } from './inference-performance'
import { OpenAIAdapter } from './openai-adapter'
import { streamSSE } from './sse-reader'

describe('模型推理速度', () => {
  test('Given Ollama 原生统计 When 读取纳秒耗时 Then 正确换算输出和预填充速度', () => {
    const performance = new InferencePerformanceTracker().accept({
      eval_count: 2283, eval_duration: 38273303000,
      prompt_eval_count: 7074, prompt_eval_duration: 4548436000,
    })
    expect(tokensPerSecond(performance?.outputTokens, performance?.outputDurationMs)).toBeCloseTo(59.65, 2)
    expect(tokensPerSecond(performance?.prefillTokens, performance?.prefillDurationMs)).toBeCloseTo(1555.26, 2)
  })

  test('Given 分开的 timings 与 usage 帧 When 输入命中缓存 Then 预填充只计算实际处理的 token', () => {
    const tracker = new InferencePerformanceTracker()
    tracker.accept({ timings: { prompt_n: 1000, prompt_ms: 100, predicted_n: 60, predicted_ms: 1000 } })
    const result = tracker.accept({ usage: { prompt_tokens_details: { cached_tokens: 900 } } })
    expect(result).toEqual({ outputTokens: 60, outputDurationMs: 1000, prefillTokens: 100, prefillDurationMs: 100 })
  })

  test.each([0, -1, NaN, Infinity, undefined])('Given 非法耗时 %s When 计算 Then 不展示速度', (duration) => {
    expect(tokensPerSecond(10, duration)).toBeUndefined()
  })

  test('Given 旧服务或完全缓存 When 没有有效计时 Then 不猜测速度', () => {
    expect(new InferencePerformanceTracker().accept({ usage: { completion_tokens: 30 } })).toBeUndefined()
    expect(new InferencePerformanceTracker().accept({ timings: { predicted_n: '30', predicted_ms: 1 } })).toBeUndefined()
    expect(new InferencePerformanceTracker().accept({
      timings: { prompt_n: 100, prompt_ms: 10 }, usage: { prompt_tokens_details: { cached_tokens: 100 } },
    })).toBeUndefined()
  })

  test('Given 多轮工具调用 When 汇总 Then 以总 token 除以模型总耗时', () => {
    const performance = sumInferencePerformance([
      { outputTokens: 100, outputDurationMs: 1000 },
      undefined,
      { outputTokens: 100, outputDurationMs: 3000 },
    ])
    expect(tokensPerSecond(performance?.outputTokens, performance?.outputDurationMs)).toBe(50)
  })

  test('Given 任意字节分块的 SSE When Chat 读取 Then 内容不变且速度随响应得到保留', async () => {
    const wire = [
      'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\n',
      'data:{"choices":[],"timings":{"predicted_n":60,"predicted_ms":1000,"prompt_n":100,"prompt_ms":50}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const bytes = new TextEncoder().encode(wire)
    let performance: InferencePerformance | undefined
    const response = observeInferencePerformance(new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
        controller.close()
      },
    }), { headers: { 'content-type': 'text/event-stream' } }), (value) => { performance = value })
    const result = await streamSSE({
      request: { url: 'http://localhost:11434/v1/chat/completions', headers: {}, body: '{}' },
      adapter: new OpenAIAdapter(), onEvent: () => {}, fetchFn: (async () => response) as unknown as typeof fetch,
    })
    expect(result.content).toBe('你好')
    expect(performance).toEqual({ outputTokens: 60, outputDurationMs: 1000, prefillTokens: 100, prefillDurationMs: 50 })
  })

  test('Given 大帧与坏帧 When 观察流 Then 原始字节与后续统计均不丢失', async () => {
    const wire = `data: ${'x'.repeat(140_000)}\ndata: broken\ndata: {"timings":{"predicted_n":20,"predicted_ms":1000}}`
    let performance: InferencePerformance | undefined
    const response = observeInferencePerformance(new Response(wire, { headers: { 'content-type': 'text/event-stream' } }), (value) => { performance = value })
    expect(await response.text()).toBe(wire)
    expect(performance?.outputTokens).toBe(20)
  })

  test('Given 非 SSE 或 HTTP 错误 When 观察 Then 原样返回响应', () => {
    const response = new Response('error', { status: 400 })
    expect(observeInferencePerformance(response, () => { throw new Error('不应调用') })).toBe(response)
  })
})
