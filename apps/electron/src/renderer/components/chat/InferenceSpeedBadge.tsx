import * as React from 'react'
import type { InferencePerformance } from '@proma/shared'
import { inferenceSpeedLines, inferenceSpeedSummary } from '@/lib/inference-speed'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export { inferenceSpeedLines } from '@/lib/inference-speed'

/** 默认一行，悬停、键盘聚焦或点击可查看易读说明。 */
export function InferenceSpeedBadge({ performance }: { performance?: InferencePerformance }): React.ReactElement | null {
  const lines = inferenceSpeedLines(performance)
  if (!lines.length) return null
  const details = (
    <>
      {lines.map((line) => <p key={line} className="tabular-nums">{line}</p>)}
      <p className="mt-2 text-muted-foreground">输出速度是模型每秒生成的 token 数，包含思考。</p>
      <p className="text-muted-foreground">预填充速度是模型服务报告的输入处理速度，缓存命中会影响结果。</p>
      <p className="mt-1 text-muted-foreground">{performance?.outputTimingSource === 'client'
        ? '按接收输出的时间统计，包含传输影响；不含首字等待和工具执行。'
        : '由模型服务计时，不含工具执行与网络等待。'}</p>
    </>
  )
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`查看模型速度，${lines.join('，')}`}
              className="rounded-sm text-xs text-muted-foreground tabular-nums hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {inferenceSpeedSummary(performance)}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 text-left">{details}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" className="w-72 text-xs leading-relaxed">{details}</PopoverContent>
    </Popover>
  )
}
