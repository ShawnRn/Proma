import { tokensPerSecond } from '@proma/shared'
import type { InferencePerformance, LiveInferenceSpeed } from '@proma/shared'
import { LiveInferenceSpeedTracker } from './live-inference-speed'

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** 兼容 Ollama 原生统计与 OpenAI 兼容接口的 timings；时长统一为毫秒。 */
export class InferencePerformanceTracker {
  private timings: Record<string, unknown> = {}

  accept(value: unknown): InferencePerformance | undefined {
    const envelope = record(value)
    if (!envelope) return undefined
    const data = record(envelope.response) ?? envelope
    // Open WebUI 会把 Ollama 原生计时保留在 usage 内。
    const usage = record(data.usage)
    const timings = record(data.timings) ?? record(usage?.timings)
    if (timings) this.timings = { ...this.timings, ...timings }
    for (const key of ['eval_count', 'eval_duration', 'prompt_eval_count', 'prompt_eval_duration', 'prompt_eval_cached_count']) {
      const value = number(data[key]) ?? number(usage?.[key])
      if (value !== undefined) this.timings[key] = value
    }

    const t = this.timings
    const result: InferencePerformance = {}
    const outputTokens = number(t.eval_count) ?? number(t.predicted_n)
    const outputDurationMs = number(t.eval_duration) !== undefined
      ? number(t.eval_duration)! / 1_000_000 : number(t.predicted_ms)
    if (tokensPerSecond(outputTokens, outputDurationMs) !== undefined) {
      result.outputTokens = outputTokens
      result.outputDurationMs = outputDurationMs
    }
    // 使用服务给出的计数与耗时配对，和其 prompt_per_second / Open WebUI 一致。
    // cached_tokens 的含义因服务而异，不能再从这组计数中统一扣除。
    const prefillTokens = number(t.prompt_eval_count) ?? number(t.prompt_n)
    const prefillDurationMs = number(t.prompt_eval_duration) !== undefined
      ? number(t.prompt_eval_duration)! / 1_000_000 : number(t.prompt_ms)
    if (tokensPerSecond(prefillTokens, prefillDurationMs) !== undefined) {
      result.prefillTokens = prefillTokens
      result.prefillDurationMs = prefillDurationMs
    }
    return Object.keys(result).length ? result : undefined
  }
}

/** 旁路读取同一条 SSE 流，不复制请求、不等待整段回复，也不改变原始字节。 */
export function observeInferencePerformance(
  response: Response,
  onPerformance: (performance: InferencePerformance | undefined) => void,
  onLiveSpeed?: (sample: LiveInferenceSpeed) => void,
): Response {
  if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return response
  const tracker = new InferencePerformanceTracker()
  const liveTracker = new LiveInferenceSpeedTracker(onLiveSpeed)
  let serverPerformance: InferencePerformance | undefined
  const decoder = new TextDecoder()
  let buffer = ''
  let discardLine = false
  const consume = (text: string): void => {
    for (const part of text.split(/(?<=\n)/)) {
      if (!discardLine) buffer += part
      // 图片 / 工具参数可能很大，统计旁路不应无限缓存。
      if (buffer.length > 128 * 1024) { buffer = ''; discardLine = true }
      if (!part.endsWith('\n')) continue
      if (!discardLine && buffer.startsWith('data:')) {
        try {
          const data: unknown = JSON.parse(buffer.slice(5).trim())
          liveTracker.accept(data)
          serverPerformance = tracker.accept(data)
          const observed = liveTracker.performance()
          onPerformance(serverPerformance?.outputTokens ? serverPerformance
            : observed || serverPerformance ? { ...observed, ...serverPerformance } : undefined)
        } catch { /* 非 JSON 哨兵或坏帧交由原解析器处理。 */ }
      }
      buffer = ''
      discardLine = false
    }
  }
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      consume(decoder.decode(chunk, { stream: true }))
      controller.enqueue(chunk)
    },
    flush() {
      consume(decoder.decode() + '\n')
      const observed = liveTracker.finish()
      onPerformance(serverPerformance?.outputTokens ? serverPerformance
        : observed || serverPerformance ? { ...observed, ...serverPerformance } : undefined)
    },
  }))
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}
