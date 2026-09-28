import type React from 'react';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';
import {
    formatPercent,
    resolveNumberFormat
} from '../utils/number-format';
import {
    formatUsageDuration,
    formatUsageResetAt,
    getUsageErrorMessage,
    resolveUsageWindowWithFallback
} from '../utils/usage';

import { isHidden } from './shared/hideable';
import {
    LOCALE_EDITOR_ACTION,
    renderUsageLocaleEditor
} from './shared/locale-editor';
import { makeTimerProgressBar } from './shared/progress-bar';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import {
    TIMEZONE_EDITOR_ACTION,
    renderUsageTimezoneEditor
} from './shared/timezone-editor';
import {
    USAGE_NO_DATA_HIDEABLE_STATE,
    cycleUsageDisplayMode,
    getUsageDisplayMode,
    getUsageDisplayModifierText,
    getUsageLocale,
    getUsageProgressBarWidth,
    getUsageTimerCustomKeybinds,
    getUsageTimezone,
    isUsage12HourClock,
    isUsageCompact,
    isUsageDateMode,
    isUsageInverted,
    isUsageProgressMode,
    isUsageSliderMode,
    makeSliderBar,
    toggleUsageCompact,
    toggleUsageDateMode,
    toggleUsageHourFormat,
    toggleUsageInverted
} from './shared/usage-display';

const BLOCK_RESET_PREVIEW_AT = '2026-03-12T08:30:00.000Z';
const USAGE_TIMER_LOADING_MESSAGE = '[Loading]';

export class BlockResetTimerWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return '显示当前 5 时时段重置窗口的剩余时间'; }
    getDisplayName(): string { return '时段重置计时'; }
    getCategory(): string { return '用量'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: getUsageDisplayModifierText(item, { includeCompact: true, includeDate: true })
        };
    }

    getHideableStates(): HideableState[] {
        return [USAGE_NO_DATA_HIDEABLE_STATE];
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'toggle-progress') {
            return cycleUsageDisplayMode(item, ['compact', 'absolute'], true);
        }

        if (action === 'toggle-invert') {
            return toggleUsageInverted(item);
        }

        if (action === 'toggle-compact') {
            return toggleUsageCompact(item);
        }

        if (action === 'toggle-date') {
            return toggleUsageDateMode(item);
        }

        if (action === 'toggle-hour-format') {
            return toggleUsageHourFormat(item);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const displayMode = getUsageDisplayMode(item);
        const inverted = isUsageInverted(item);
        const compact = isUsageCompact(item);
        const dateMode = isUsageDateMode(item);
        const format = resolveNumberFormat('percent', item, settings);

        if (context.isPreview) {
            const previewPercent = inverted ? 90.0 : 10.0;

            if (isUsageProgressMode(displayMode)) {
                const barWidth = getUsageProgressBarWidth(displayMode);
                const progressBar = makeTimerProgressBar(previewPercent, barWidth);
                return formatRawOrLabeledValue(item, '重置 ', `[${progressBar}] ${formatPercent(previewPercent, format)}`);
            }

            if (isUsageSliderMode(displayMode)) {
                const slider = makeSliderBar(previewPercent);
                const sliderDisplay = displayMode === 'slider'
                    ? `${slider} ${formatPercent(previewPercent, format)}`
                    : slider;
                return formatRawOrLabeledValue(item, '重置 ', sliderDisplay);
            }

            if (dateMode) {
                const resetAt = formatUsageResetAt(
                    BLOCK_RESET_PREVIEW_AT,
                    compact,
                    getUsageTimezone(item),
                    getUsageLocale(item),
                    isUsage12HourClock(item)
                );
                return formatRawOrLabeledValue(item, '重置: ', resetAt ?? (compact ? '03-12 08:30Z' : '2026-03-12 08:30 UTC'));
            }

            return formatRawOrLabeledValue(item, '重置: ', compact ? '4时30分' : '4时 30分');
        }

        const usageData = context.usageData ?? {};
        const window = resolveUsageWindowWithFallback(usageData, context.blockMetrics);

        if (!window) {
            if (isHidden(item, USAGE_NO_DATA_HIDEABLE_STATE.key)) {
                return null;
            }

            if (usageData.error) {
                return getUsageErrorMessage(usageData.error);
            }

            return formatRawOrLabeledValue(item, '重置: ', item.rawValue ? USAGE_TIMER_LOADING_MESSAGE : '[加载中]');
        }

        if (isUsageProgressMode(displayMode)) {
            const barWidth = getUsageProgressBarWidth(displayMode);
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const progressBar = makeTimerProgressBar(percent, barWidth);
            return formatRawOrLabeledValue(item, '重置 ', `[${progressBar}] ${formatPercent(percent, format)}`);
        }

        if (isUsageSliderMode(displayMode)) {
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const slider = makeSliderBar(percent);
            const sliderDisplay = displayMode === 'slider'
                ? `${slider} ${formatPercent(percent, format)}`
                : slider;
            return formatRawOrLabeledValue(item, '重置 ', sliderDisplay);
        }

        if (dateMode) {
            const timezone = getUsageTimezone(item);
            const locale = getUsageLocale(item);
            const resetAt = formatUsageResetAt(usageData.sessionResetAt, compact, timezone, locale, isUsage12HourClock(item));
            if (resetAt) {
                return formatRawOrLabeledValue(item, '重置: ', resetAt);
            }
        }

        const remainingTime = formatUsageDuration(window.remainingMs, compact);
        return formatRawOrLabeledValue(item, '重置: ', remainingTime);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        return getUsageTimerCustomKeybinds(item, {
            includeDate: true,
            includeHourFormat: true,
            includeLocale: true,
            includeTimezone: true
        });
    }

    renderEditor(props: WidgetEditorProps): React.ReactElement | null {
        if (props.action === LOCALE_EDITOR_ACTION) {
            return renderUsageLocaleEditor(props);
        }

        if (props.action === TIMEZONE_EDITOR_ACTION) {
            return renderUsageTimezoneEditor(props);
        }

        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
