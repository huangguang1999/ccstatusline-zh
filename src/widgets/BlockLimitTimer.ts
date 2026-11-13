import type { RenderContext } from '../types/RenderContext';

import { LimitTimerWidget } from './shared/limit-timer-widget';

export class BlockLimitTimerWidget extends LimitTimerWidget {
    protected readonly label = '额度耗尽: ';
    protected readonly previewLimitInMs = 73 * 60 * 1000;

    getDescription(): string { return '按当前速度估算 5 小时时段额度耗尽的剩余时间；仅在重置前会耗尽时显示'; }
    getDisplayName(): string { return '时段额度耗尽计时'; }

    protected getLimitInMs(context: RenderContext): number | null {
        return context.sessionForecast?.limitInMs ?? null;
    }
}
