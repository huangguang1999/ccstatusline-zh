import type { RenderUsageData } from '../types/RenderContext';

import { ExtraUsageAmountWidget } from './shared/extra-usage-amount-widget';

export class ExtraUsageRemainingWidget extends ExtraUsageAmountWidget {
    protected readonly label = '超额剩余: ';
    protected readonly previewDollars = 3894;

    getDescription(): string { return '显示每月超额用量额度的剩余金额（Pro/Max 超额消费或 Enterprise 消费）'; }
    getDisplayName(): string { return '超额用量剩余'; }

    protected getDollars(data: RenderUsageData): number | null {
        if (data.extraUsageLimit === undefined || data.extraUsageUsed === undefined) {
            return null;
        }
        // Both extraUsageLimit and extraUsageUsed are in cents
        return Math.max(0, data.extraUsageLimit / 100 - data.extraUsageUsed / 100);
    }
}
