import { describe, expect, test } from 'bun:test'
import type { LiveInferenceSpeed, InferencePerformance } from '@proma/shared'
import { LiveInferenceSpeedTracker } from './live-inference-speed'
import { observeInferencePerformance } from './inference-performance'

describe('实时输出速度', () => {
  test('Given 首字前等待一分钟 When 输出帧到达 Then 从生成阶段采样而非整轮耗时', () => {
    const samples: LiveInferenceSpeed[] = []
    const tracker = new LiveInferenceSpeedTracker((sample) => samples.push(sample))
    tracker.accept({ type: 'response.created' }, 0)
    for (let i = 0; i <= 10; i++) tracker.accept({ type: 'response.output_text.delta', delta: '字' }, 60_000 + i * 100)
    expect(samples.length).toBeGreaterThan(0)
    expect(samples[0]?.tokensPerSecond).toBe(10)
    expect(samples[0]?.active).toBe(true)
    tracker.accept({ response: { usage: { output_tokens: 11 } } }, 61_500)
    expect(tracker.finish(62_000)).toEqual({ outputTokens: 11, outputDurationMs: 1100, outputTimingSource: 'client' })
    expect(samples.at(-1)?.active).toBe(false)
  })

  test('Given 思考和工具参数输出 When 生成 Then 计入同一模型的实时速度', () => {
    const samples: LiveInferenceSpeed[] = []
    const tracker = new LiveInferenceSpeedTracker((sample) => samples.push(sample))
    tracker.accept({ choices: [{ delta: { reasoning_content: '思考' } }] }, 0)
    tracker.accept({ type: 'response.function_call_arguments.delta', delta: '{}' }, 500)
    expect(samples[0]?.tokensPerSecond).toBe(2)
  })

  test('Given 心跳、角色或单帧回复 When 没有可计量的生成区间 Then 不伪造最终速度', () => {
    const tracker = new LiveInferenceSpeedTracker()
    tracker.accept({ choices: [{ delta: { role: 'assistant' } }] }, 0)
    tracker.accept({ type: 'response.created' }, 50)
    tracker.accept({ type: 'response.output_text.delta', delta: '完整回复' }, 100)
    tracker.accept({ response: { usage: { output_tokens: 20 } } }, 200)
    expect(tracker.finish()).toBeUndefined()
  })

  test('Given Responses 完成帧仅有 usage When Pi 读取到完成事件 Then 无须等待 EOF 就能拿到速度', async () => {
    let performance: InferencePerformance | undefined
    const encoder = new TextEncoder()
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const response = observeInferencePerformance(new Response(new ReadableStream<Uint8Array>({
      start(value) { controller = value },
    }), { headers: { 'content-type': 'text/event-stream' } }), (value) => { performance = value })
    const reader = response.body!.getReader()
    controller!.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"你"}\n\n'))
    await reader.read()
    await Bun.sleep(5)
    controller!.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"好"}\n\n'))
    await reader.read()
    controller!.enqueue(encoder.encode('data: {"type":"response.completed","response":{"usage":{"output_tokens":2}}}\n\n'))
    await reader.read()
    expect(performance?.outputTokens).toBe(2)
    expect(performance?.outputTimingSource).toBe('client')
    expect(performance?.outputDurationMs).toBeGreaterThan(0)
    await reader.cancel()
  })
})
