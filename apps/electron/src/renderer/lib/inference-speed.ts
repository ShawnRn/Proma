import type { InferencePerformance } from '@proma/shared'
import { tokensPerSecond } from '@proma/shared'

export function inferenceSpeedLines(performance?: InferencePerformance): string[] {
  if (!performance) return []
  const output = tokensPerSecond(performance.outputTokens, performance.outputDurationMs)
  const prefill = tokensPerSecond(performance.prefillTokens, performance.prefillDurationMs)
  return [
    ...(output === undefined ? [] : [`输出速度：${performance.outputTimingSource === 'client' ? '≈ ' : ''}${output.toFixed(1)} tok/s`]),
    ...(prefill === undefined ? [] : [`预填充速度：${prefill.toFixed(1)} tok/s`]),
    ...(prefill === undefined && output !== undefined ? ['预填充速度：暂不可用'] : []),
  ]
}

/** 底部同时显示两项有效速度，缺失项只在详情里解释。 */
export function inferenceSpeedSummary(performance?: InferencePerformance): string {
  return inferenceSpeedLines(performance).filter((line) => line.endsWith('tok/s')).join(' · ')
}
