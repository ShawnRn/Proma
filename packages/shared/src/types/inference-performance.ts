/** 模型服务返回的推理统计；仅保存有对应计时的 token 数。 */
export interface InferencePerformance {
  outputTokens?: number
  outputDurationMs?: number
  prefillTokens?: number
  prefillDurationMs?: number
}
