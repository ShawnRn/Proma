import type { LiveInferenceSpeed } from '@proma/shared'

export function formatLiveInferenceSpeed(sample?: LiveInferenceSpeed, now = Date.now()): string {
  const speed = sample?.tokensPerSecond
  if (!sample?.active || speed === undefined || !Number.isFinite(speed) || speed < 0) return '— tok/s'
  // 停顿时不能让上一次高速度一直挂在界面上。
  const current = now - sample.sampledAt > 2000 ? 0 : speed
  return `≈ ${current.toFixed(1)} tok/s`
}
