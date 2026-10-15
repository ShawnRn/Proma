import type { InferencePerformance, LiveInferenceSpeed } from '@proma/shared'

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

/** 基于模型输出帧而非网络字节块采样，排除首 token 前的加载和预填充等待。 */
export class LiveInferenceSpeedTracker {
  private firstAt?: number
  private lastAt?: number
  private lastEmittedAt = 0
  private frames: number[] = []
  private frameCount = 0
  private outputTokens?: number

  constructor(private readonly onSample?: (sample: LiveInferenceSpeed) => void) {}

  accept(value: unknown, now = Date.now()): void {
    const data = object(value)
    if (!data) return
    const response = object(data.response)
    const usage = object(response?.usage) ?? object(data.usage)
    const count = usage?.output_tokens ?? usage?.completion_tokens ?? data.eval_count
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) this.outputTokens = count
    const choices = Array.isArray(data.choices) ? data.choices : []
    const delta = object(object(choices[0])?.delta)
    const nativeMessage = object(data.message)
    const isOutput = (typeof delta?.content === 'string' && delta.content.length > 0)
      || (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.length > 0)
      || (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0)
      || (typeof data.type === 'string' && [
        'response.output_text.delta', 'response.reasoning_text.delta',
        'response.reasoning_summary_text.delta', 'response.function_call_arguments.delta',
      ].includes(data.type) && typeof data.delta === 'string' && data.delta.length > 0)
      || (typeof nativeMessage?.content === 'string' && nativeMessage.content.length > 0)
      || (typeof nativeMessage?.thinking === 'string' && nativeMessage.thinking.length > 0)
    if (!isOutput) return
    this.firstAt ??= now
    this.lastAt = now
    this.frameCount++
    this.frames.push(now)
    while (this.frames.length > 2 && this.frames[0]! < now - 2000) this.frames.shift()
    const duration = now - this.frames[0]!
    if (duration < 500 || now - this.lastEmittedAt < 250) return
    this.lastEmittedAt = now
    this.onSample?.({ tokensPerSecond: (this.frames.length - 1) * 1000 / duration, sampledAt: now, active: true })
  }

  finish(now = Date.now()): InferencePerformance | undefined {
    this.onSample?.({ sampledAt: now, active: false })
    return this.performance()
  }

  performance(): InferencePerformance | undefined {
    // 单帧输出无法测量生成时长；不把请求等待伪装为输出速度。
    if (this.firstAt === undefined || this.lastAt === undefined || this.frameCount < 2 || this.lastAt <= this.firstAt || !this.outputTokens) return undefined
    return {
      outputTokens: this.outputTokens,
      outputDurationMs: (this.lastAt - this.firstAt) * this.frameCount / (this.frameCount - 1),
      outputTimingSource: 'client',
    }
  }
}
