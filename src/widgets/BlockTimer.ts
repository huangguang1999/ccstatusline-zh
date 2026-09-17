import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    formatPercent,
    resolveNumberFormat
} from '../utils/number-format';
import {
    formatUsageDuration,
    resolveUsageWindowWithFallback
} from '../utils/usage';

import { isHidden } from './shared/hideable';
import { makeTimerProgressBar } from './shared/progress-bar';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import {
    cycleUsageDisplayMode,
    getUsageDisplayMode,
    getUsageDisplayModifierText,
    getUsageProgressBarWidth,
    getUsageTimerCustomKeybinds,
    isUsageCompact,
    isUsageInverted,
    isUsageProgressMode,
    isUsageSliderMode,
    makeSliderBar,
    toggleUsageCompact,
    toggleUsageInverted
} from './shared/usage-display';

const NO_DATA_HIDEABLE_STATE: HideableState = { key: 'no-data', label: '无活跃时段时' };

export class BlockTimerWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示当前 5 时时段的已用时间或进度'; }
    getDisplayName(): string { return '时段计时器'; }
    getCategory(): string { return '用量'; }

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
        const displayMode = getUsageDisplayMode(item);
        const inverted = isUsageInverted(item);
        const compact = isUsageCompact(item);
        const format = resolveNumberFormat('percent', item, settings);

        if (context.isPreview) {
            const previewPercent = inverted ? 26.1 : 73.9;

            if (isUsageProgressMode(displayMode)) {
                const barWidth = getUsageProgressBarWidth(displayMode);
                const progressBar = makeTimerProgressBar(previewPercent, barWidth);
                return formatRawOrLabeledValue(item, '时段 ', `[${progressBar}] ${formatPercent(previewPercent, format)}`);
            }

            if (isUsageSliderMode(displayMode)) {
                const slider = makeSliderBar(previewPercent);
                const sliderDisplay = displayMode === 'slider'
                    ? `${slider} ${formatPercent(previewPercent, format)}`
                    : slider;
                return formatRawOrLabeledValue(item, '时段 ', sliderDisplay);
            }

            return formatRawOrLabeledValue(item, '时段: ', compact ? '3时45分' : '3时 45分');
        }

        const usageData = context.usageData ?? {};
        const window = resolveUsageWindowWithFallback(usageData, context.blockMetrics);

        if (!window) {
            if (isHidden(item, NO_DATA_HIDEABLE_STATE.key)) {
                return null;
            }

            const emptyPercent = formatPercent(0, format);
            if (isUsageProgressMode(displayMode)) {
                const barWidth = getUsageProgressBarWidth(displayMode);
                const emptyBar = '░'.repeat(barWidth);
                return formatRawOrLabeledValue(item, '时段 ', `[${emptyBar}] ${emptyPercent}`);
            }

            if (isUsageSliderMode(displayMode)) {
                const emptySlider = makeSliderBar(0);
                const sliderDisplay = displayMode === 'slider'
                    ? `${emptySlider} ${emptyPercent}`
                    : emptySlider;
                return formatRawOrLabeledValue(item, '时段 ', sliderDisplay);
            }

            return formatRawOrLabeledValue(item, '时段: ', compact ? '0时' : '0时 0分');
        }

        if (isUsageProgressMode(displayMode)) {
            const barWidth = getUsageProgressBarWidth(displayMode);
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const progressBar = makeTimerProgressBar(percent, barWidth);
            return formatRawOrLabeledValue(item, '时段 ', `[${progressBar}] ${formatPercent(percent, format)}`);
        }

        if (isUsageSliderMode(displayMode)) {
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const slider = makeSliderBar(percent);
            const sliderDisplay = displayMode === 'slider'
                ? `${slider} ${formatPercent(percent, format)}`
                : slider;
            return formatRawOrLabeledValue(item, '时段 ', sliderDisplay);
        }

        const elapsedTime = formatUsageDuration(window.elapsedMs, compact);
        return formatRawOrLabeledValue(item, '时段: ', elapsedTime);
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
