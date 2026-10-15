import type { LiveInferenceSpeed } from '@proma/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatLiveInferenceSpeed } from '@/lib/live-inference-speed'

export function LiveInferenceSpeedBadge({ sample }: { sample?: LiveInferenceSpeed }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={`实时输出速度 ${formatLiveInferenceSpeed(sample)}`}
          className="rounded-sm text-[13px] text-muted-foreground/75 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {formatLiveInferenceSpeed(sample)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <p>实时输出速度（估算）</p>
        <p className="text-muted-foreground">生成时持续更新，包含思考；短暂停顿时会回落。</p>
        <p className="text-muted-foreground">回复完成后显示最终速度。</p>
      </TooltipContent>
    </Tooltip>
  )
}
