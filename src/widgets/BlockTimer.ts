import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { resolveNumberFormat } from '../utils/number-format';
import {
    formatUsageDuration,
    resolveUsageWindowWithFallback
} from '../utils/usage';

import { isHidden } from './shared/hideable';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import {
    cycleUsageDisplayMode,
    formatUsageBar,
    getUsageDisplayMode,
    getUsageDisplayModifierText,
    getUsageTimerCustomKeybinds,
    isUsageCompact,
    isUsageInverted,
    isUsageProgressMode,
    isUsageSliderMode,
    toggleUsageCompact,
    toggleUsageInverted
} from './shared/usage-display';

const LABEL = '时段: ';
const BAR_LABEL = '时段 ';

const NO_DATA_HIDEABLE_STATE: HideableState = { key: 'no-data', label: '无活跃时段时' };

export class BlockTimerWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示当前 5 小时时段的已用时间或进度'; }
    getDisplayName(): string { return '时段计时器'; }
    getCategory(): string { return '用量'; }
    getLabelPrefix(item: WidgetItem): string {
        const displayMode = getUsageDisplayMode(item);
        return isUsageProgressMode(displayMode) || isUsageSliderMode(displayMode) ? BAR_LABEL : LABEL;
    }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: getUsageDisplayModifierText(item, { includeCompact: true })
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'toggle-progress') {
            return cycleUsageDisplayMode(item, ['compact'], true);
        }

        if (action === 'toggle-invert') {
            return toggleUsageInverted(item);
        }

        if (action === 'toggle-compact') {
            return toggleUsageCompact(item);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const inverted = isUsageInverted(item);
        const compact = isUsageCompact(item);
        const format = resolveNumberFormat('percent', item, settings);

        if (context.isPreview) {
            const previewPercent = inverted ? 26.1 : 73.9;

            const bar = formatUsageBar(item, previewPercent, format);
            if (bar !== null) {
                return formatRawOrLabeledValue(item, this.getLabelPrefix(item), bar);
            }

            return formatRawOrLabeledValue(item, this.getLabelPrefix(item), compact ? '3时45分' : '3时 45分');
        }

        const usageData = context.usageData ?? {};
        const window = resolveUsageWindowWithFallback(usageData, context.blockMetrics);

        if (!window) {
            if (isHidden(item, NO_DATA_HIDEABLE_STATE.key)) {
                return null;
            }
            const bar = formatUsageBar(item, 0, format);
            if (bar !== null) {
                return formatRawOrLabeledValue(item, this.getLabelPrefix(item), bar);
            }

            return formatRawOrLabeledValue(item, this.getLabelPrefix(item), compact ? '0时' : '0时 0分');
        }

        const bar = formatUsageBar(item, inverted ? window.remainingPercent : window.elapsedPercent, format);
        if (bar !== null) {
            return formatRawOrLabeledValue(item, this.getLabelPrefix(item), bar);
        }

        const elapsedTime = formatUsageDuration(window.elapsedMs, compact);
        return formatRawOrLabeledValue(item, this.getLabelPrefix(item), elapsedTime);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        return getUsageTimerCustomKeybinds(item);
    }

    getHideableStates(): HideableState[] {
        return [NO_DATA_HIDEABLE_STATE];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
