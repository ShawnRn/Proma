import { describe, expect, test } from 'bun:test'
import { formatLiveInferenceSpeed } from './live-inference-speed'

describe('运行栏实时速度', () => {
  test('Given 正在输出 When 刷新 Then 展示 tok/s 并标注估算', () => {
    expect(formatLiveInferenceSpeed({ tokensPerSecond: 59.65, sampledAt: 1000, active: true }, 1100)).toBe('≈ 59.6 tok/s')
  })
  test('Given 输出停顿超过两秒 When 运行计时刷新 Then 不沿用旧的高速度', () => {
    expect(formatLiveInferenceSpeed({ tokensPerSecond: 70, sampledAt: 1000, active: true }, 3100)).toBe('≈ 0.0 tok/s')
  })
  test('Given 等待首字、工具执行或非法数据 When 显示 Then 使用占位', () => {
    expect(formatLiveInferenceSpeed()).toBe('— tok/s')
    expect(formatLiveInferenceSpeed({ sampledAt: 0, active: false })).toBe('— tok/s')
    expect(formatLiveInferenceSpeed({ tokensPerSecond: Infinity, sampledAt: 0, active: true })).toBe('— tok/s')
  })
})
