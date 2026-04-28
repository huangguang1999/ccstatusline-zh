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
import { BlockResetTimerWidget } from '../BlockResetTimer';

import { runUsageTimerEditorSuite } from './helpers/usage-widget-suites';

function render(widget: BlockResetTimerWidget, item: WidgetItem, context: RenderContext = {}): string | null {
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('BlockResetTimerWidget', () => {
    let mockFormatUsageDuration: { mockReturnValue: (value: string) => void };
    let mockFormatUsageResetAt: { mockReturnValue: (value: string | null) => void };
    let mockGetUsageErrorMessage: { mockReturnValue: (value: string) => void };
    let mockResolveUsageWindowWithFallback: { mockReturnValue: (value: UsageWindowMetrics | null) => void };

    beforeEach(() => {
        vi.restoreAllMocks();
        mockFormatUsageDuration = vi.spyOn(usage, 'formatUsageDuration');
        mockFormatUsageResetAt = vi.spyOn(usage, 'formatUsageResetAt');
        mockGetUsageErrorMessage = vi.spyOn(usage, 'getUsageErrorMessage');
        mockResolveUsageWindowWithFallback = vi.spyOn(usage, 'resolveUsageWindowWithFallback');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders preview using block-style reset format', () => {
        const widget = new BlockResetTimerWidget();

        expect(render(widget, { id: 'reset', type: 'reset-timer' }, { isPreview: true })).toBe('重置: 4时 30分');
    });

    it('renders remaining time in time mode', () => {
        const widget = new BlockResetTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 3600000,
            remainingMs: 14400000,
            elapsedPercent: 20,
            remainingPercent: 80
        });
        mockFormatUsageDuration.mockReturnValue('4时');

        expect(render(widget, { id: 'reset', type: 'reset-timer' }, { usageData: {} })).toBe('重置: 4时');
    });

    it('renders short progress bar with inverted fill', () => {
        const widget = new BlockResetTimerWidget();
        const item: WidgetItem = {
            id: 'reset',
            type: 'reset-timer',
            metadata: {
                display: 'progress-short',
                invert: 'true'
            }
        };

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 14400000,
            remainingMs: 3600000,
            elapsedPercent: 80,
            remainingPercent: 20
        });

        expect(render(widget, item, { usageData: {} })).toBe('重置 [███░░░░░░░░░░░░░] 20.0%');
    });

    it('returns usage error when no timer data is available', () => {
        const widget = new BlockResetTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue(null);
        mockGetUsageErrorMessage.mockReturnValue('[超时]');

        expect(render(widget, { id: 'reset', type: 'reset-timer' }, { usageData: { error: 'timeout' } })).toBe('[超时]');
    });

    it('returns null when neither timer data nor usage error exists', () => {
        const widget = new BlockResetTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue(null);

        expect(render(widget, { id: 'reset', type: 'reset-timer' }, { usageData: {} })).toBeNull();
    });

    it('shows raw value without label in time mode', () => {
        const widget = new BlockResetTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 4500000,
            remainingMs: 13500000,
            elapsedPercent: 25,
            remainingPercent: 75
        });
        mockFormatUsageDuration.mockReturnValue('3时 45分');

        expect(render(widget, { id: 'reset', type: 'reset-timer', rawValue: true }, { usageData: {} })).toBe('3时 45分');
    });

    it('shows reset timestamp in date mode', () => {
        const widget = new BlockResetTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 4500000,
            remainingMs: 13500000,
            elapsedPercent: 25,
            remainingPercent: 75
        });
        mockFormatUsageResetAt.mockReturnValue('2026-03-12 08:30 UTC');

        expect(render(widget,
            { id: 'reset', type: 'reset-timer', metadata: { absolute: 'true', timezone: 'Asia/Tokyo', locale: 'ja-JP', hour12: 'true' } },
            { usageData: { sessionResetAt: '2026-03-12T08:30:00.000Z' } }
        )).toBe('重置: 2026-03-12 08:30 UTC');
        expect(mockFormatUsageResetAt).toHaveBeenCalledWith('2026-03-12T08:30:00.000Z', false, 'Asia/Tokyo', 'ja-JP', true);
    });

    it('shows configured timestamp settings in editor display only in timestamp mode', () => {
        const widget = new BlockResetTimerWidget();

        expect(widget.getEditorDisplay({
            id: 'reset',
            type: 'reset-timer',
            metadata: { timezone: 'America/New_York', locale: 'ja-JP', hour12: 'true' }
        }).modifierText).toBeUndefined();
        expect(widget.getEditorDisplay({
            id: 'reset',
            type: 'reset-timer',
            metadata: { absolute: 'true', timezone: 'America/New_York', locale: 'ja-JP', hour12: 'true' }
        }).modifierText).toBe('(日期, 12 时制, 时区: America/New_York, 地区: ja-JP)');
    });

    it('shows timestamp keybinds only in timestamp mode', () => {
        const widget = new BlockResetTimerWidget();

        expect(widget.getCustomKeybinds({
            id: 'reset',
            type: 'reset-timer',
            metadata: { absolute: 'true' }
        })).toEqual([
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 's', label: '(s)短时间', action: 'toggle-compact' },
            { key: 't', label: '(t)时间戳', action: 'toggle-date' },
            { key: 'h', label: '12/24 (h)小时', action: 'toggle-hour-format' },
            { key: 'z', label: '时(z)区', action: 'edit-timezone' },
            { key: 'l', label: '(l)地区', action: 'edit-locale' }
        ]);
    });

    it('toggles hour format metadata', () => {
        const widget = new BlockResetTimerWidget();
        const baseItem: WidgetItem = {
            id: 'reset',
            type: 'reset-timer',
            metadata: { absolute: 'true' }
        };

        const hour12 = widget.handleEditorAction('toggle-hour-format', baseItem);
        const cleared = widget.handleEditorAction('toggle-hour-format', hour12 ?? baseItem);

        expect(hour12?.metadata?.hour12).toBe('true');
        expect(cleared?.metadata?.hour12).toBe('false');
    });

    runUsageTimerEditorSuite({
        baseItem: { id: 'reset', type: 'reset-timer' },
        createWidget: () => new BlockResetTimerWidget(),
        expectedDisplayName: '时段重置计时',
        expectedTimeKeybinds: [
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 's', label: '(s)短时间', action: 'toggle-compact' },
            { key: 't', label: '(t)时间戳', action: 'toggle-date' }
        ],
        supportsDateMode: true,
        expectedModifierText: '(短进度条, 反转)',
        expectedProgressKeybinds: [
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 'v', label: '(v)反转填充', action: 'toggle-invert' }
        ],
        modifierItem: {
            id: 'reset',
            type: 'reset-timer',
            metadata: { display: 'progress-short', invert: 'true' }
        }
    });
});
