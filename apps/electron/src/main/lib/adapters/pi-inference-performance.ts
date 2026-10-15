import type { StreamFn } from '@earendil-works/pi-agent-core'
import { observeInferencePerformance } from '@proma/core'
import type { InferencePerformance, LiveInferenceSpeed } from '@proma/shared'

const messages = new WeakMap<object, InferencePerformance>()

/** 只观察当前 provider 请求；每次请求 / 重试独立计量，不影响工具或其它会话。 */
export function withPiInferencePerformance(streamFn: StreamFn, onLiveSpeed?: (sample: LiveInferenceSpeed) => void): StreamFn {
  return async (model, context, options) => {
    let performance: InferencePerformance | undefined
    let settled = false
    const fetchFn = options?.fetch ?? globalThis.fetch
    const stream = await streamFn(model, context, {
      ...options,
      fetch: (async (url: Parameters<typeof fetchFn>[0], init?: Parameters<typeof fetchFn>[1]) => {
        performance = undefined
        return observeInferencePerformance(await fetchFn(url, init), (sample) => { performance = sample }, (sample) => {
          if (!settled) onLiveSpeed?.(sample)
        })
      }) as typeof fetchFn,
    })
    const originalResult = stream.result.bind(stream)
    stream.result = async () => {
      const message = await originalResult()
      if (!settled) onLiveSpeed?.({ sampledAt: Date.now(), active: false })
      settled = true
      if (message.stopReason !== 'error' && message.stopReason !== 'aborted') {
        rememberPiPerformance(message, performance)
      }
      return message
    }
    return stream
  }
}

export function rememberPiPerformance(message: object, performance?: InferencePerformance): void {
  if (performance) messages.set(message, performance)
}

export function getPiMessagePerformance(message: object): InferencePerformance | undefined {
  return messages.get(message)
}
