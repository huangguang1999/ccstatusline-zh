import type {
    CustomKeybind,
    WidgetItem
} from '../../types/Widget';
import {
    DEFAULT_RESET_LOCALE,
    canonicalizeLocale
} from '../../utils/locales';

import { makeModifierText } from './editor-display';
import {
    isMetadataFlagEnabled,
    removeMetadataKeys,
    toggleMetadataFlag
} from './metadata';

export type UsageDisplayMode = 'time' | 'progress' | 'progress-short' | 'slider' | 'slider-only';

const SLIDER_WIDTH = 10;

const PROGRESS_TOGGLE_KEYBIND: CustomKeybind = { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' };
const INVERT_TOGGLE_KEYBIND: CustomKeybind = { key: 'v', label: '(v)反转填充', action: 'toggle-invert' };
const COMPACT_TOGGLE_KEYBIND: CustomKeybind = { key: 's', label: '(s)短时间', action: 'toggle-compact' };
const CURSOR_TOGGLE_KEYBIND: CustomKeybind = { key: 't', label: '(t)时间游标', action: 'toggle-cursor' };
const DATE_TOGGLE_KEYBIND: CustomKeybind = { key: 't', label: '(t)时间戳', action: 'toggle-date' };
const HOUR_FORMAT_TOGGLE_KEYBIND: CustomKeybind = { key: 'h', label: '12/24 小时(h)', action: 'toggle-hour-format' };
const WEEKDAY_TOGGLE_KEYBIND: CustomKeybind = { key: 'w', label: '(w)星期', action: 'toggle-weekday' };
const TIMEZONE_KEYBIND: CustomKeybind = { key: 'z', label: '时区(z)', action: 'edit-timezone' };
const LOCALE_KEYBIND: CustomKeybind = { key: 'l', label: '(l)地区', action: 'edit-locale' };

export function getUsageDisplayMode(item: WidgetItem): UsageDisplayMode {
    const mode = item.metadata?.display;
    if (mode === 'progress' || mode === 'progress-short' || mode === 'slider' || mode === 'slider-only') {
        return mode;
    }
    return 'time';
}

export function isUsageProgressMode(mode: UsageDisplayMode): boolean {
    return mode === 'progress' || mode === 'progress-short';
}

export function isUsageSliderMode(mode: UsageDisplayMode): boolean {
    return mode === 'slider' || mode === 'slider-only';
}

interface SliderBarOptions { cursorPercent?: number }

export function makeSliderBar(percent: number, width: number = SLIDER_WIDTH, options?: SliderBarOptions): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * width);
    const cursorPos = options?.cursorPercent !== undefined
        ? Math.min(Math.floor((Math.max(0, Math.min(100, options.cursorPercent)) / 100) * width), width - 1)
        : -1;

    let bar = '';
    for (let i = 0; i < width; i++) {
        if (i === cursorPos) {
            bar += '│';
        } else if (i < filled) {
            bar += '▓';
        } else {
            bar += '░';
        }
    }

    return bar;
}

export function getUsageProgressBarWidth(mode: UsageDisplayMode): number {
    return mode === 'progress' ? 32 : 16;
}

export function isUsageInverted(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'invert');
}

export function isUsageCompact(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'compact');
}

export function isUsageCursorEnabled(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'cursor');
}

export function toggleUsageCursor(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'cursor');
}

export function isUsageDateMode(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'absolute');
}

export function isUsage12HourClock(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'hour12');
}

export function getUsageTimezone(item: WidgetItem): string | undefined {
    const tz = item.metadata?.timezone;
    return typeof tz === 'string' && tz.length > 0 ? tz : undefined;
}

export function getUsageLocale(item: WidgetItem): string | undefined {
    const locale = item.metadata?.locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
}

export function getUsageLocaleModifier(item: WidgetItem): string | undefined {
    const locale = getUsageLocale(item);
    return locale ? `地区: ${locale}` : undefined;
}

export function getUsageTimezoneModifier(item: WidgetItem): string | undefined {
    const timezone = getUsageTimezone(item);
    return timezone ? `时区: ${timezone}` : undefined;
}

export function setUsageTimezone(item: WidgetItem, timezone: string): WidgetItem {
    if (timezone === 'UTC') {
        return removeMetadataKeys(item, ['timezone']);
    }

    return {
        ...item,
        metadata: {
            ...item.metadata,
            timezone
        }
    };
}

export function setUsageLocale(item: WidgetItem, locale: string): WidgetItem {
    const canonicalLocale = canonicalizeLocale(locale);
    if (!canonicalLocale || canonicalLocale === DEFAULT_RESET_LOCALE) {
        return removeMetadataKeys(item, ['locale']);
    }

    return {
        ...item,
        metadata: {
            ...item.metadata,
            locale: canonicalLocale
        }
    };
}

export function toggleUsageCompact(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'compact');
}

export function toggleUsageDateMode(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'absolute');
}

export function toggleUsageHourFormat(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'hour12');
}

export function isUsageWeekdayEnabled(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, 'weekday');
}

export function toggleUsageWeekday(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'weekday');
}

interface UsageDisplayModifierOptions {
    includeCompact?: boolean;
    includeDate?: boolean;
    showUsageDirection?: boolean;
}

export function getUsageDisplayModifierText(
    item: WidgetItem,
    options: UsageDisplayModifierOptions = {}
): string | undefined {
    const mode = getUsageDisplayMode(item);
    const modifiers: string[] = [];

    if (mode === 'progress') {
        modifiers.push('长进度条');
    } else if (mode === 'progress-short') {
        modifiers.push('中进度条');
    } else if (mode === 'slider') {
        modifiers.push('短进度条');
    } else if (mode === 'slider-only') {
        modifiers.push('仅短进度条');
    }

    if (options.showUsageDirection) {
        modifiers.push(isUsageInverted(item) ? '剩余' : '已用');
    } else if (isUsageInverted(item)) {
        modifiers.push('反转');
    }

    if (isUsageCursorEnabled(item) && (isUsageProgressMode(mode) || isUsageSliderMode(mode))) {
        modifiers.push('时间游标');
    }

    if (options.includeCompact && !isUsageProgressMode(mode) && isUsageCompact(item)) {
        modifiers.push('紧凑');
    }

    if (options.includeDate && !isUsageProgressMode(mode) && isUsageDateMode(item)) {
        modifiers.push('日期');
    }

    if (options.includeDate && !isUsageProgressMode(mode) && isUsageDateMode(item) && isUsage12HourClock(item)) {
        modifiers.push('12 时制');
    }

    const timezoneModifier = getUsageTimezoneModifier(item);
    if (options.includeDate && !isUsageProgressMode(mode) && isUsageDateMode(item) && timezoneModifier) {
        modifiers.push(timezoneModifier);
    }

    const localeModifier = getUsageLocaleModifier(item);
    if (options.includeDate && !isUsageProgressMode(mode) && isUsageDateMode(item) && localeModifier) {
        modifiers.push(localeModifier);
    }

    return makeModifierText(modifiers);
}

export function cycleUsageDisplayMode(item: WidgetItem, disabledInProgressKeys: string[] = [], includeSlider = false, preserveInvertInTime = false): WidgetItem {
    const currentMode = getUsageDisplayMode(item);
    let nextMode: UsageDisplayMode;
    if (includeSlider) {
        nextMode = currentMode === 'time'
            ? 'progress'
            : currentMode === 'progress'
                ? 'progress-short'
                : currentMode === 'progress-short'
                    ? 'slider'
                    : currentMode === 'slider'
                        ? 'slider-only'
                        : 'time';
    } else {
        nextMode = currentMode === 'time'
            ? 'progress'
            : currentMode === 'progress'
                ? 'progress-short'
                : 'time';
    }

    const keysToRemove = nextMode === 'time' ? (preserveInvertInTime ? ['cursor'] : ['invert', 'cursor']) : disabledInProgressKeys;
    const nextItem = removeMetadataKeys(item, keysToRemove);
    const nextMetadata: Record<string, string> = {
        ...(nextItem.metadata ?? {}),
        display: nextMode
    };

    return {
        ...nextItem,
        metadata: nextMetadata
    };
}

export function toggleUsageInverted(item: WidgetItem): WidgetItem {
    return toggleMetadataFlag(item, 'invert');
}

export function getUsagePercentCustomKeybinds(item?: WidgetItem, includeCursor = true): CustomKeybind[] {
    const nextDirection = item && isUsageInverted(item) ? '已用' : '剩余';
    const keybinds: CustomKeybind[] = [
        PROGRESS_TOGGLE_KEYBIND,
        { key: 'u', label: `(u)显示${nextDirection}`, action: 'toggle-invert' }
    ];

    if (item && includeCursor) {
        const mode = getUsageDisplayMode(item);
        if (isUsageProgressMode(mode) || isUsageSliderMode(mode)) {
            keybinds.push(CURSOR_TOGGLE_KEYBIND);
        }
    }

    return keybinds;
}

interface UsageTimerCustomKeybindOptions {
    includeDate?: boolean;
    includeHourFormat?: boolean;
    includeLocale?: boolean;
    includeTimezone?: boolean;
    includeWeekday?: boolean;
}

export function getUsageTimerCustomKeybinds(
    item?: WidgetItem,
    options: UsageTimerCustomKeybindOptions = {}
): CustomKeybind[] {
    const keybinds = [PROGRESS_TOGGLE_KEYBIND];

    if (item && isUsageProgressMode(getUsageDisplayMode(item))) {
        keybinds.push(INVERT_TOGGLE_KEYBIND);
    } else {
        keybinds.push(COMPACT_TOGGLE_KEYBIND);

        if (options.includeDate) {
            keybinds.push(DATE_TOGGLE_KEYBIND);
        }
    }

    if (item && isUsageDateMode(item) && !isUsageProgressMode(getUsageDisplayMode(item))) {
        if (options.includeHourFormat) {
            keybinds.push(HOUR_FORMAT_TOGGLE_KEYBIND);
        }

        if (options.includeWeekday) {
            keybinds.push(WEEKDAY_TOGGLE_KEYBIND);
        }

        if (options.includeTimezone) {
            keybinds.push(TIMEZONE_KEYBIND);
        }

        if (options.includeLocale) {
            keybinds.push(LOCALE_KEYBIND);
        }
    }

    return keybinds;
}
