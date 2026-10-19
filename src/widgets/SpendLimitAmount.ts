import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { resolveNumberFormat } from '../utils/number-format';

import { formatUsageCurrency } from './shared/currency';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '消费: ';

export class SpendLimitAmountWidget implements Widget {
    getDefaultColor(): string { return 'brightMagenta'; }
    getDescription(): string { return '显示 Claude 应用网关消费限额中的已消费金额和限额（美元）'; }
    getDisplayName(): string { return '消费限额金额'; }
    getCategory(): string { return '用量'; }
    getLabelPrefix(): string { return LABEL; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const format = resolveNumberFormat('cost', item, settings);
        const data = context.isPreview
            ? { spendLimitUsedUsd: 314.12, spendLimitLimitUsd: 500 }
            : context.usageData;

        // Both dollar fields can be absent even when the limit itself is reported
        if (data?.spendLimitUsedUsd === undefined || data.spendLimitLimitUsd === undefined) {
            return null;
        }

        const used = formatUsageCurrency(data.spendLimitUsedUsd, 'USD', format);
        const limit = formatUsageCurrency(data.spendLimitLimitUsd, 'USD', format);

        return formatRawOrLabeledValue(item, LABEL, `${used} / ${limit}`);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
