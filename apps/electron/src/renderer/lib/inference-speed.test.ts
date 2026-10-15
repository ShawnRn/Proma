import { describe, expect, test } from 'bun:test'
import { inferenceSpeedLines, inferenceSpeedSummary } from './inference-speed'

describe('回复底部速度文案', () => {
  test('Given 服务返回两项计时 When 显示回复底部 Then 同时显示输出与预填充 tok/s', () => {
    expect(inferenceSpeedSummary({ outputTokens: 60, outputDurationMs: 1000, prefillTokens: 1000, prefillDurationMs: 500 }))
      .toBe('输出速度：60.0 tok/s · 预填充速度：2000.0 tok/s')
  })
  test('Given 只有客户端输出计时 When 显示 Then 保留估算标记且详情解释缺失的预填充', () => {
    const performance = { outputTokens: 20, outputDurationMs: 1000, outputTimingSource: 'client' as const }
    expect(inferenceSpeedSummary(performance)).toBe('输出速度：≈ 20.0 tok/s')
    expect(inferenceSpeedLines(performance)).toContain('预填充速度：暂不可用')
  })
  test('Given 旧消息或无效时长 When 显示 Then 不出现虚构速度', () => {
    expect(inferenceSpeedSummary()).toBe('')
    expect(inferenceSpeedSummary({ prefillTokens: 100, prefillDurationMs: 0 })).toBe('')
    expect(inferenceSpeedSummary({ prefillTokens: 100, prefillDurationMs: 1000 })).toBe('预填充速度：100.0 tok/s')
  })
})
