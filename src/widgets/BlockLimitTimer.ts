import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { formatUsageDuration } from '../utils/usage';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import {
    getUsageCompactKeybind,
    getUsageTextModifierText,
    isUsageCompact,
    toggleUsageCompact
} from './shared/usage-display';

const LABEL = '额度耗尽: ';
const PREVIEW_LIMIT_IN_MS = 73 * 60 * 1000;
// Rounded down like the reset timers, but never "0m": the limit hasn't been hit yet.
const MIN_SHOWN_MS = 60 * 1000;

export class BlockLimitTimerWidget implements Widget {
    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return '按当前速度估算 5 小时时段额度耗尽的剩余时间；仅在重置前会耗尽时显示'; }
    getDisplayName(): string { return '时段额度耗尽计时'; }
    getCategory(): string { return '用量'; }
    getLabelPrefix(): string { return LABEL; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: getUsageTextModifierText(item, { includeCompact: true })
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return action === 'toggle-compact' ? toggleUsageCompact(item) : null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const compact = isUsageCompact(item);
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, LABEL, formatUsageDuration(PREVIEW_LIMIT_IN_MS, compact, true, item.rawValue));
        }

        const limitInMs = context.sessionForecast?.limitInMs;
        if (limitInMs === null || limitInMs === undefined) {
            return null;
        }

        return formatRawOrLabeledValue(item, LABEL, formatUsageDuration(Math.max(MIN_SHOWN_MS, limitInMs), compact, true, item.rawValue));
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [getUsageCompactKeybind()];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
