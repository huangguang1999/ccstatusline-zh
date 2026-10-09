import type { RenderUsageData } from '../types/RenderContext';

import { ExtraUsageAmountWidget } from './shared/extra-usage-amount-widget';

export class ExtraUsageUsedWidget extends ExtraUsageAmountWidget {
    protected readonly label = '超额已用: ';
    protected readonly previewDollars = 106;

    getDescription(): string { return '显示超额用量的已消费金额（超出 Pro/Max 套餐额度的消费或 Enterprise 消费）'; }
    getDisplayName(): string { return '超额已用'; }

    protected getDollars(data: RenderUsageData): number | null {
        // extraUsageUsed is in cents
        return data.extraUsageUsed === undefined ? null : data.extraUsageUsed / 100;
    }
}
