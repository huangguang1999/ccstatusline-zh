import type { RenderContext } from '../types/RenderContext';
import { calculateContextPercentageMetrics } from '../utils/context-percentage';

import { ContextPercentageWidgetBase } from './shared/context-percentage-widget-base';

export class ContextPercentageWidget extends ContextPercentageWidgetBase {
    protected readonly labelPrefix = 'Ctx';
    protected readonly previewUsedPercent = 9.3;

    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示上下文窗口已用或剩余百分比'; }
    getDisplayName(): string { return '上下文 %'; }

    protected getUsedPercentage(context: RenderContext): number | null {
        return calculateContextPercentageMetrics(context)?.usedPercentage ?? null;
    }
}
