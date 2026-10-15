import type { InferencePerformance } from '../types/inference-performance'

/** 无计时、零耗时或非法数据不产生速度，避免显示 Infinity 或误导性的估算。 */
export function tokensPerSecond(tokens?: number, durationMs?: number): number | undefined {
  if (tokens === undefined || durationMs === undefined
    || !Number.isFinite(tokens) || !Number.isFinite(durationMs)
    || tokens <= 0 || durationMs <= 0) return undefined
  const speed = tokens * 1000 / durationMs
  return Number.isFinite(speed) ? speed : undefined
}

/** 多轮工具调用按 token 总数 / 推理总时长汇总，不把工具执行计入速度。 */
export function sumInferencePerformance(items: Array<InferencePerformance | undefined>): InferencePerformance | undefined {
  const result: InferencePerformance = {}
  for (const item of items) {
    if (!item) continue
    if (tokensPerSecond(item.outputTokens, item.outputDurationMs) !== undefined) {
      result.outputTokens = (result.outputTokens ?? 0) + item.outputTokens!
      result.outputDurationMs = (result.outputDurationMs ?? 0) + item.outputDurationMs!
      if (item.outputTimingSource === 'client') result.outputTimingSource = 'client'
    }
    if (tokensPerSecond(item.prefillTokens, item.prefillDurationMs) !== undefined) {
      result.prefillTokens = (result.prefillTokens ?? 0) + item.prefillTokens!
      result.prefillDurationMs = (result.prefillDurationMs ?? 0) + item.prefillDurationMs!
    }
  }
  return Object.keys(result).length ? result : undefined
}
