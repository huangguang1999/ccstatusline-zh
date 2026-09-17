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
    resolveWeeklyUsageWindow
} from '../utils/usage';

import { makeModifierText } from './shared/editor-display';
import { isHidden } from './shared/hideable';
import {
    LOCALE_EDITOR_ACTION,
    renderUsageLocaleEditor
} from './shared/locale-editor';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';
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
    getUsageLocale,
    getUsageLocaleModifier,
    getUsageProgressBarWidth,
    getUsageTimerCustomKeybinds,
    getUsageTimezone,
    getUsageTimezoneModifier,
    isUsage12HourClock,
    isUsageCompact,
    isUsageDateMode,
    isUsageInverted,
    isUsageProgressMode,
    isUsageSliderMode,
    isUsageWeekdayEnabled,
    makeSliderBar,
    toggleUsageCompact,
    toggleUsageDateMode,
    toggleUsageHourFormat,
    toggleUsageInverted,
    toggleUsageWeekday
} from './shared/usage-display';

const WEEKLY_PREVIEW_DURATION_MS = 36.5 * 60 * 60 * 1000;
const WEEKLY_RESET_PREVIEW_AT = '2026-03-15T08:30:00.000Z';
const USAGE_TIMER_LOADING_MESSAGE = '[Loading]';

function isWeeklyResetHoursOnly(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'hours');
}

function toggleWeeklyResetHoursOnly(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'hours');
}

function getWeeklyResetModifierText(item: WidgetItem): string | undefined {
    const displayMode = getUsageDisplayMode(item);
    const dateMode = isUsageDateMode(item);
    const isBarMode = isUsageProgressMode(displayMode) || isUsageSliderMode(displayMode);
    const modifiers: string[] = [];

    if (displayMode === 'progress') {
        modifiers.push('长进度条');
    } else if (displayMode === 'progress-short') {
        modifiers.push('中进度条');
    } else if (displayMode === 'slider') {
        modifiers.push('短进度条');
    } else if (displayMode === 'slider-only') {
        modifiers.push('仅短进度条');
    }

    if (isUsageInverted(item)) {
        modifiers.push('反转');
    }

    if (!isBarMode) {
        if (isUsageCompact(item)) {
            modifiers.push('紧凑');
        }

        if (dateMode) {
            modifiers.push('日期');

            if (isUsage12HourClock(item)) {
                modifiers.push('12 时制');
            }

            if (isUsageWeekdayEnabled(item)) {
                modifiers.push('星期');
            }
        } else if (isWeeklyResetHoursOnly(item)) {
            modifiers.push('仅小时');
        }
    }

    const timezoneModifier = getUsageTimezoneModifier(item);
    if (!isBarMode && dateMode && timezoneModifier) {
        modifiers.push(timezoneModifier);
    }

    const localeModifier = getUsageLocaleModifier(item);
    if (!isBarMode && dateMode && localeModifier) {
        modifiers.push(localeModifier);
    }

    return makeModifierText(modifiers);
}

export class WeeklyResetTimerWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return '显示周用量重置倒计时'; }
    getDisplayName(): string { return '周重置计时'; }
    getCategory(): string { return '用量'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: getWeeklyResetModifierText(item)
        };
    }

    getHideableStates(): HideableState[] {
        return [USAGE_NO_DATA_HIDEABLE_STATE];
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'toggle-progress') {
            return cycleUsageDisplayMode(item, ['compact', 'hours', 'absolute'], true);
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

        if (action === 'toggle-weekday') {
            return toggleUsageWeekday(item);
        }

        if (action === 'toggle-hours') {
            return toggleWeeklyResetHoursOnly(item);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const displayMode = getUsageDisplayMode(item);
        const inverted = isUsageInverted(item);
        const compact = isUsageCompact(item);
        const dateMode = isUsageDateMode(item);
        const useDays = !isWeeklyResetHoursOnly(item);
        const format = resolveNumberFormat('percent', item, settings);

        if (context.isPreview) {
            const previewPercent = inverted ? 90.0 : 10.0;

            if (isUsageProgressMode(displayMode)) {
                const barWidth = getUsageProgressBarWidth(displayMode);
                const progressBar = makeTimerProgressBar(previewPercent, barWidth);
                return formatRawOrLabeledValue(item, '周重置 ', `[${progressBar}] ${formatPercent(previewPercent, format)}`);
            }

            if (isUsageSliderMode(displayMode)) {
                const slider = makeSliderBar(previewPercent);
                const sliderDisplay = displayMode === 'slider'
                    ? `${slider} ${formatPercent(previewPercent, format)}`
                    : slider;
                return formatRawOrLabeledValue(item, '周重置 ', sliderDisplay);
            }

            if (dateMode) {
                const weekday = isUsageWeekdayEnabled(item);
                const resetAt = formatUsageResetAt(
                    WEEKLY_RESET_PREVIEW_AT,
                    compact,
                    getUsageTimezone(item),
                    getUsageLocale(item),
                    isUsage12HourClock(item),
                    weekday
                );
                const fallback = weekday
                    ? (compact ? 'Sun 08:30Z' : 'Sun 08:30 UTC')
                    : (compact ? '03-15 08:30Z' : '2026-03-15 08:30 UTC');
                return formatRawOrLabeledValue(item, '周重置: ', resetAt ?? fallback);
            }

            return formatRawOrLabeledValue(item, '周重置: ', formatUsageDuration(WEEKLY_PREVIEW_DURATION_MS, compact, useDays));
        }

        const usageData = context.usageData ?? {};
        const window = resolveWeeklyUsageWindow(usageData);

        if (!window) {
            if (isHidden(item, USAGE_NO_DATA_HIDEABLE_STATE.key)) {
                return null;
            }

            if (usageData.error) {
                return getUsageErrorMessage(usageData.error);
            }

            return formatRawOrLabeledValue(item, '周重置: ', item.rawValue ? USAGE_TIMER_LOADING_MESSAGE : '[加载中]');
        }

        if (isUsageProgressMode(displayMode)) {
            const barWidth = getUsageProgressBarWidth(displayMode);
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const progressBar = makeTimerProgressBar(percent, barWidth);
            return formatRawOrLabeledValue(item, '周重置 ', `[${progressBar}] ${formatPercent(percent, format)}`);
        }

        if (isUsageSliderMode(displayMode)) {
            const percent = inverted ? window.remainingPercent : window.elapsedPercent;
            const slider = makeSliderBar(percent);
            const sliderDisplay = displayMode === 'slider'
                ? `${slider} ${formatPercent(percent, format)}`
                : slider;
            return formatRawOrLabeledValue(item, '周重置 ', sliderDisplay);
        }

        if (dateMode) {
            const timezone = getUsageTimezone(item);
            const locale = getUsageLocale(item);
            const resetAt = formatUsageResetAt(usageData.weeklyResetAt, compact, timezone, locale, isUsage12HourClock(item), isUsageWeekdayEnabled(item));
            if (resetAt) {
                return formatRawOrLabeledValue(item, '周重置: ', resetAt);
            }
        }

        const remainingTime = formatUsageDuration(window.remainingMs, compact, useDays);
        return formatRawOrLabeledValue(item, '周重置: ', remainingTime);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        const keybinds = getUsageTimerCustomKeybinds(item, {
            includeDate: true,
            includeHourFormat: true,
            includeWeekday: true,
            includeLocale: true,
            includeTimezone: true
        });

        const mode = item ? getUsageDisplayMode(item) : 'time';
        const isBarMode = isUsageProgressMode(mode) || isUsageSliderMode(mode);
        if (!item || (!isBarMode && !isUsageDateMode(item))) {
            keybinds.push({ key: 'o', label: '(o)仅小时', action: 'toggle-hours' });
        }

        return keybinds;
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
