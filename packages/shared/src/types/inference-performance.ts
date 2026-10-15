/** 模型服务返回的推理统计；仅保存有对应计时的 token 数。 */
export interface InferencePerformance {
  /** 接口未提供服务端计时时，按接收输出的时间统计。 */
  outputTimingSource?: 'client'
  outputTokens?: number
  outputDurationMs?: number
  prefillTokens?: number
  prefillDurationMs?: number
}

/** 生成中的速度采样；token 数按输出分片估算，不能用于计费。 */
export interface LiveInferenceSpeed {
  tokensPerSecond?: number
  sampledAt: number
  active: boolean
}
