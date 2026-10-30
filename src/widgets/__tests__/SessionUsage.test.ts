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
import { SessionUsageWidget } from '../SessionUsage';

import { runUsagePercentWidgetSuite } from './helpers/usage-widget-suites';

let mockGetUsageErrorMessage: { mockReturnValue: (value: string) => void };
const usageErrorMessageMock = {
    mockReturnValue(value: string): void {
        mockGetUsageErrorMessage.mockReturnValue(value);
    }
};

const halfElapsedWindow: UsageWindowMetrics = {
    sessionDurationMs: 18000000,
    elapsedMs: 9000000,
    remainingMs: 9000000,
    elapsedPercent: 50,
    remainingPercent: 50
};

function render(widget: SessionUsageWidget, item: WidgetItem, context: RenderContext = {}): string | null {
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('SessionUsageWidget', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockGetUsageErrorMessage = vi.spyOn(usage, 'getUsageErrorMessage');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the time cursor in short bar modes', () => {
        const widget = new SessionUsageWidget();
        const context: RenderContext = { usageData: { sessionUsage: 20 } };

        vi.spyOn(usage, 'resolveUsageWindowWithFallback').mockReturnValue(halfElapsedWindow);

        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { cursor: 'true', display: 'slider' }
        }, context)).toBe('时段: ▓▓░░░│░░░░ 20.0%');
        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { cursor: 'true', display: 'slider-only' }
        }, context)).toBe('时段: ▓▓░░░│░░░░');
    });

    it('places the time cursor at the time left when showing remaining usage', () => {
        const widget = new SessionUsageWidget();
        // 30% used with 20% of the block gone: 70% of the quota and 80% of the time left
        const context: RenderContext = { usageData: { sessionUsage: 30 } };

        vi.spyOn(usage, 'resolveUsageWindowWithFallback').mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 3600000,
            remainingMs: 14400000,
            elapsedPercent: 20,
            remainingPercent: 80
        });

        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { cursor: 'true', display: 'slider' }
        }, context)).toBe('时段: ▓▓│░░░░░░░ 30.0%');
        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { cursor: 'true', display: 'slider', invert: 'true' }
        }, context)).toBe('时段: ▓▓▓▓▓▓▓░│░ 70.0%');
    });

    it('applies the label override to every display mode', () => {
        const widget = new SessionUsageWidget();
        const context: RenderContext = { usageData: { sessionUsage: 20 } };
        const metadata = { label: '5 小时 ' };

        expect(widget.getLabelPrefix()).toBe('时段: ');
        expect(render(widget, { id: 'session', type: 'session-usage', metadata }, context)).toBe('5 小时 20.0%');
        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { ...metadata, display: 'slider-only' }
        }, context)).toBe('5 小时 ▓▓░░░░░░░░');
    });

    it('是时段用量，默认标签为“时段: ”并支持自定义标签', () => {
        const widget = new SessionUsageWidget();
        const context: RenderContext = { usageData: { sessionUsage: 20 } };

        expect(widget.getDisplayName()).toBe('时段用量');
        expect(render(widget, { id: 'session', type: 'session-usage' }, context)).toBe('时段: 20.0%');
        expect(render(widget, { id: 'session', type: 'session-usage', metadata: { label: '会话: ' } }, context)).toBe('会话: 20.0%');
    });

    it('declares the no-data and at-limit hideable states', () => {
        expect(new SessionUsageWidget().getHideableStates().map(state => state.key)).toEqual(['no-data', 'at-limit']);
    });

    describe('at-limit hide state', () => {
        const item: WidgetItem = { id: 'session', type: 'session-usage', metadata: { hide: 'at-limit' } };

        // A real render's payload carries the percent that merged usage data
        // takes as its sessionUsage
        function withPayloadPercent(usageData: { sessionUsage: number; apiSessionUsage?: number }): RenderContext {
            return { usageData, data: { rate_limits: { five_hour: { used_percentage: usageData.sessionUsage } } } };
        }

        // The raw percent decides, so 99.7% that a whole-number percent shows as
        // "100%" still counts as under the limit
        it.each([
            ['under 100%', { sessionUsage: 60 }, '时段: 60.0%'],
            ['just under 100%', { sessionUsage: 99.7 }, '时段: 99.7%'],
            ['the usage API under 100% after the payload reached it', { sessionUsage: 100, apiSessionUsage: 2 }, '时段: 100.0%']
        ])('shows the percent when the block\'s usage is %s', (_label, usageData, expected) => {
            expect(render(new SessionUsageWidget(), item, withPayloadPercent(usageData))).toBe(expected);
        });

        it.each([
            ['at 100%', { sessionUsage: 100 }],
            ['over 100%', { sessionUsage: 100.4 }],
            ['at 100% in the usage API while the payload lags', { sessionUsage: 97, apiSessionUsage: 100 }]
        ])('hides the percent when the block\'s usage is %s', (_label, usageData) => {
            expect(render(new SessionUsageWidget(), item, withPayloadPercent(usageData))).toBeNull();
        });

        // Merged usage data keeps an API percent prefetch rejected, as stale or
        // from a block that has since reset, when the payload has none of its own
        it('shows the percent when only a rejected API percent is at 100%', () => {
            expect(render(new SessionUsageWidget(), item, { usageData: { sessionUsage: 100 }, data: { rate_limits: { five_hour: { resets_at: 1 } } } })).toBe('时段: 100.0%');
        });

        it('keeps the no-data behavior when the usage is unknown', () => {
            mockGetUsageErrorMessage.mockReturnValue('[Timeout]');

            expect(render(new SessionUsageWidget(), item, { usageData: { error: 'timeout' } })).toBe('[Timeout]');
            expect(render(new SessionUsageWidget(), { ...item, metadata: { hide: 'no-data,at-limit' } }, { usageData: { error: 'timeout' } })).toBeNull();
        });

        it('keeps showing the percent at 100% when the state is off', () => {
            expect(render(new SessionUsageWidget(), { id: 'session', type: 'session-usage' }, { usageData: { sessionUsage: 100 } })).toBe('时段: 100.0%');
        });

        it('keeps the preview sample', () => {
            const widget = new SessionUsageWidget();

            expect(render(widget, item, { isPreview: true })).toBe(render(widget, { id: 'session', type: 'session-usage' }, { isPreview: true }));
        });

        // With both states on, the percent and the reset countdown take turns:
        // exactly one of them shows at every render
        it.each([
            ['under 100%', { sessionUsage: 60 }, 'percent'],
            ['just under 100%', { sessionUsage: 99.7 }, 'percent'],
            ['at 100%', { sessionUsage: 100 }, 'timer'],
            ['at 100% in the usage API while the payload lags', { sessionUsage: 97, apiSessionUsage: 100 }, 'timer'],
            ['under 100% in the usage API after the payload reached it', { sessionUsage: 100, apiSessionUsage: 2 }, 'percent']
        ])('swaps with Block Reset Timer\'s under-limit state when the block is %s', (_label, usageData, shown) => {
            vi.spyOn(usage, 'resolveUsageWindowWithFallback').mockReturnValue(halfElapsedWindow);
            const timerItem: WidgetItem = { id: 'reset', type: 'reset-timer', metadata: { hide: 'under-limit' } };

            const percent = render(new SessionUsageWidget(), item, withPayloadPercent(usageData));
            const timer = new BlockResetTimerWidget().render(timerItem, withPayloadPercent(usageData), DEFAULT_SETTINGS);

            expect([percent !== null, timer !== null]).toEqual(shown === 'percent' ? [true, false] : [false, true]);
        });
    });

    runUsagePercentWidgetSuite({
        baseItem: { id: 'session', type: 'session-usage' },
        createWidget: () => new SessionUsageWidget(),
        errorMessageMock: usageErrorMessageMock,
        expectedInvertedTime: '时段: 76.5%',
        expectedModifierText: '(中进度条, 剩余)',
        expectedPreviewInvertedTime: '时段: 80.0%',
        expectedProgress: '时段: [████████████░░░░] 76.5%',
        expectedRawInvertedTime: '76.5%',
        expectedRawProgress: '[████████░░░░░░░░░░░░░░░░░░░░░░░░] 23.4%',
        expectedRawTime: '23.4%',
        expectedTime: '时段: 23.4%',
        expectedWholePercentTime: '时段: 23%',
        modifierItem: {
            id: 'session',
            type: 'session-usage',
            metadata: { display: 'progress-short', invert: 'true' }
        },
        progressItem: {
            id: 'session',
            type: 'session-usage',
            metadata: { display: 'progress-short', invert: 'true' }
        },
        rawProgressItem: {
            id: 'session',
            type: 'session-usage',
            rawValue: true,
            metadata: { display: 'progress' }
        },
        rawTimeItem: {
            id: 'session',
            type: 'session-usage',
            rawValue: true
        },
        render,
        usageField: 'sessionUsage',
        usageValue: 23.45
    });
});
