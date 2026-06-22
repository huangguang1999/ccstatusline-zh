import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getUsageErrorMessage } from '../utils/usage';

import { formatUsageCurrency } from './shared/currency';
import {
    appendHideDisabledModifier,
    getHideExtraUsageDisabledKeybind,
    handleToggleExtraUsageDisabledAction,
    isHideExtraUsageDisabledEnabled
} from './shared/extra-usage-disabled';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

export class ExtraUsageUsedWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示额外使用（按需计费超额）已消耗的美元金额'; }
    getDisplayName(): string { return '已用超额额度'; }
    getCategory(): string { return '用量'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: appendHideDisabledModifier(undefined, item)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return handleToggleExtraUsageDisabledAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, '已用超额: ', '$106.00');
        }

        const data = context.usageData ?? {};
        if (data.extraUsageEnabled === false) {
            return isHideExtraUsageDisabledEnabled(item)
                ? null
                : formatRawOrLabeledValue(item, '已用超额: ', 'n/a');
        }
        if (data.extraUsageEnabled !== true || data.extraUsageUsed === undefined) {
            if (data.error)
                return getUsageErrorMessage(data.error);
            return null;
        }

        // extraUsageUsed is in cents
        const usedDollars = data.extraUsageUsed / 100;
        const formatted = formatUsageCurrency(usedDollars, data.extraUsageCurrency);

        return formatRawOrLabeledValue(item, '已用超额: ', formatted);
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [getHideExtraUsageDisabledKeybind()];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
