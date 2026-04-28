import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import * as usage from '../../utils/usage';
import type { UsageWindowMetrics } from '../../utils/usage-types';
import { WeeklyResetTimerWidget } from '../WeeklyResetTimer';

import { runUsageTimerEditorSuite } from './helpers/usage-widget-suites';

function render(widget: WeeklyResetTimerWidget, item: WidgetItem, context: RenderContext = {}): string | null {
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('WeeklyResetTimerWidget', () => {
    let mockFormatUsageDuration: { mockReturnValue: (value: string) => void };
    let mockFormatUsageResetAt: { mockReturnValue: (value: string | null) => void };
    let mockGetUsageErrorMessage: { mockReturnValue: (value: string) => void };
    let mockResolveWeeklyUsageWindow: { mockReturnValue: (value: UsageWindowMetrics | null) => void };

    beforeEach(() => {
        vi.restoreAllMocks();
        mockFormatUsageDuration = vi.spyOn(usage, 'formatUsageDuration');
        mockFormatUsageResetAt = vi.spyOn(usage, 'formatUsageResetAt');
        mockGetUsageErrorMessage = vi.spyOn(usage, 'getUsageErrorMessage');
        mockResolveWeeklyUsageWindow = vi.spyOn(usage, 'resolveWeeklyUsageWindow');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders preview using weekly reset format', () => {
        const widget = new WeeklyResetTimerWidget();

        expect(render(widget, { id: 'weekly-reset', type: 'weekly-reset-timer' }, { isPreview: true })).toBe('周重置: 1天 12时 30分');
    });

    it('renders preview in hours-only mode when toggled', () => {
        const widget = new WeeklyResetTimerWidget();

        expect(render(widget, {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { hours: 'true' }
        }, { isPreview: true })).toBe('周重置: 36时 30分');
    });

    it('renders remaining time in time mode', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue({
            sessionDurationMs: 604800000,
            elapsedMs: 120000000,
            remainingMs: 484800000,
            elapsedPercent: 19.8412698413,
            remainingPercent: 80.1587301587
        });
        mockFormatUsageDuration.mockReturnValue('134时 40分');

        expect(render(widget, { id: 'weekly-reset', type: 'weekly-reset-timer' }, { usageData: {} })).toBe('周重置: 134时 40分');
        expect(mockFormatUsageDuration).toHaveBeenCalledWith(484800000, false, true);
    });

    it('renders remaining time in hours-only mode', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue({
            sessionDurationMs: 604800000,
            elapsedMs: 120000000,
            remainingMs: 484800000,
            elapsedPercent: 19.8412698413,
            remainingPercent: 80.1587301587
        });
        mockFormatUsageDuration.mockReturnValue('134时 40分');

        expect(render(widget, {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { hours: 'true' }
        }, { usageData: {} })).toBe('周重置: 134时 40分');
        expect(mockFormatUsageDuration).toHaveBeenCalledWith(484800000, false, false);
    });

    it('renders short progress bar with inverted fill', () => {
        const widget = new WeeklyResetTimerWidget();
        const item: WidgetItem = {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: {
                display: 'progress-short',
                invert: 'true'
            }
        };

        mockResolveWeeklyUsageWindow.mockReturnValue({
            sessionDurationMs: 604800000,
            elapsedMs: 483840000,
            remainingMs: 120960000,
            elapsedPercent: 80,
            remainingPercent: 20
        });

        expect(render(widget, item, { usageData: {} })).toBe('周重置 [███░░░░░░░░░░░░░] 20.0%');
    });

    it('returns usage error when no weekly reset data is available', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue(null);
        mockGetUsageErrorMessage.mockReturnValue('[超时]');

        expect(render(widget, { id: 'weekly-reset', type: 'weekly-reset-timer' }, { usageData: { error: 'timeout' } })).toBe('[超时]');
    });

    it('returns null when neither weekly reset data nor usage error exists', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue(null);

        expect(render(widget, { id: 'weekly-reset', type: 'weekly-reset-timer' }, { usageData: {} })).toBeNull();
    });

    it('shows raw value without label in time mode', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue({
            sessionDurationMs: 604800000,
            elapsedMs: 171900000,
            remainingMs: 432900000,
            elapsedPercent: 28.4216269841,
            remainingPercent: 71.5783730159
        });
        mockFormatUsageDuration.mockReturnValue('120时 15分');

        expect(render(widget, { id: 'weekly-reset', type: 'weekly-reset-timer', rawValue: true }, { usageData: {} })).toBe('120时 15分');
    });

    it('shows weekly reset timestamp in date mode', () => {
        const widget = new WeeklyResetTimerWidget();

        mockResolveWeeklyUsageWindow.mockReturnValue({
            sessionDurationMs: 604800000,
            elapsedMs: 171900000,
            remainingMs: 432900000,
            elapsedPercent: 28.4216269841,
            remainingPercent: 71.5783730159
        });
        mockFormatUsageResetAt.mockReturnValue('2026-03-15 08:30 UTC');

        expect(render(widget,
            { id: 'weekly-reset', type: 'weekly-reset-timer', metadata: { absolute: 'true', timezone: 'Asia/Tokyo', locale: 'ja-JP', hour12: 'true' } },
            { usageData: { weeklyResetAt: '2026-03-15T08:30:00.000Z' } }
        )).toBe('周重置: 2026-03-15 08:30 UTC');
        expect(mockFormatUsageResetAt).toHaveBeenCalledWith('2026-03-15T08:30:00.000Z', false, 'Asia/Tokyo', 'ja-JP', true);
    });

    it('shows configured timestamp settings in editor display only in timestamp mode', () => {
        const widget = new WeeklyResetTimerWidget();

        expect(widget.getEditorDisplay({
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { timezone: 'America/New_York', locale: 'ja-JP', hour12: 'true' }
        }).modifierText).toBeUndefined();
        expect(widget.getEditorDisplay({
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { absolute: 'true', timezone: 'America/New_York', locale: 'ja-JP', hour12: 'true' }
        }).modifierText).toBe('(日期, 12 时制, 时区: America/New_York, 地区: ja-JP)');
    });

    it('toggles hours-only metadata and shows hours-only modifier text', () => {
        const widget = new WeeklyResetTimerWidget();
        const baseItem: WidgetItem = { id: 'weekly-reset', type: 'weekly-reset-timer' };

        const hoursOnly = widget.handleEditorAction('toggle-hours', baseItem);
        const cleared = widget.handleEditorAction('toggle-hours', hoursOnly ?? baseItem);

        expect(hoursOnly?.metadata?.hours).toBe('true');
        expect(cleared?.metadata?.hours).toBe('false');
        expect(widget.getEditorDisplay(baseItem).modifierText).toBeUndefined();
        expect(widget.getEditorDisplay({
            ...baseItem,
            metadata: { hours: 'true' }
        }).modifierText).toBe('(仅小时)');
    });

    it('toggles hour format metadata', () => {
        const widget = new WeeklyResetTimerWidget();
        const baseItem: WidgetItem = {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { absolute: 'true' }
        };

        const hour12 = widget.handleEditorAction('toggle-hour-format', baseItem);
        const cleared = widget.handleEditorAction('toggle-hour-format', hour12 ?? baseItem);

        expect(hour12?.metadata?.hour12).toBe('true');
        expect(cleared?.metadata?.hour12).toBe('false');
    });

    it('clears compact and hours-only metadata when cycling into progress mode', () => {
        const widget = new WeeklyResetTimerWidget();
        const updated = widget.handleEditorAction('toggle-progress', {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: {
                compact: 'true',
                hours: 'true'
            }
        });

        expect(updated?.metadata?.display).toBe('progress');
        expect(updated?.metadata?.compact).toBeUndefined();
        expect(updated?.metadata?.hours).toBeUndefined();
    });

    it('ignores stale hours-only metadata in progress mode editor modifiers', () => {
        const widget = new WeeklyResetTimerWidget();

        expect(widget.getEditorDisplay({
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: {
                display: 'progress',
                hours: 'true'
            }
        }).modifierText).toBe('(长进度条)');
    });

    it('hides hours-only keybind while timestamp mode is active', () => {
        const widget = new WeeklyResetTimerWidget();

        expect(widget.getCustomKeybinds({
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: {
                absolute: 'true',
                hours: 'true'
            }
        })).toEqual([
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 's', label: '(s)短时间', action: 'toggle-compact' },
            { key: 't', label: '(t)时间戳', action: 'toggle-date' },
            { key: 'h', label: '12/24 (h)小时', action: 'toggle-hour-format' },
            { key: 'z', label: '时(z)区', action: 'edit-timezone' },
            { key: 'l', label: '(l)地区', action: 'edit-locale' }
        ]);
    });

    runUsageTimerEditorSuite({
        baseItem: { id: 'weekly-reset', type: 'weekly-reset-timer' },
        createWidget: () => new WeeklyResetTimerWidget(),
        expectedDisplayName: '周重置计时',
        expectedTimeKeybinds: [
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 's', label: '(s)短时间', action: 'toggle-compact' },
            { key: 't', label: '(t)时间戳', action: 'toggle-date' },
            { key: 'h', label: '(h)仅小时', action: 'toggle-hours' }
        ],
        supportsDateMode: true,
        expectedModifierText: '(短进度条, 反转)',
        expectedProgressKeybinds: [
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 'v', label: '(v)反转填充', action: 'toggle-invert' }
        ],
        modifierItem: {
            id: 'weekly-reset',
            type: 'weekly-reset-timer',
            metadata: { display: 'progress-short', invert: 'true' }
        }
    });
});
