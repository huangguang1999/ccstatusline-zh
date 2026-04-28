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
import { BlockTimerWidget } from '../BlockTimer';

import { runUsageTimerEditorSuite } from './helpers/usage-widget-suites';

function render(widget: BlockTimerWidget, item: WidgetItem, context: RenderContext = {}): string | null {
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('BlockTimerWidget', () => {
    let mockFormatUsageDuration: { mockReturnValue: (value: string) => void };
    let mockResolveUsageWindowWithFallback: { mockReturnValue: (value: UsageWindowMetrics | null) => void };

    beforeEach(() => {
        vi.restoreAllMocks();
        mockFormatUsageDuration = vi.spyOn(usage, 'formatUsageDuration');
        mockResolveUsageWindowWithFallback = vi.spyOn(usage, 'resolveUsageWindowWithFallback');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders elapsed time in time mode', () => {
        const widget = new BlockTimerWidget();
        const item: WidgetItem = { id: 'block', type: 'block-timer' };

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 13500000,
            remainingMs: 4500000,
            elapsedPercent: 75,
            remainingPercent: 25
        });
        mockFormatUsageDuration.mockReturnValue('3时 45分');

        expect(render(widget, item, { usageData: {} })).toBe('时段: 3时 45分');
    });

    it('renders short progress bar with inverted fill', () => {
        const widget = new BlockTimerWidget();
        const item: WidgetItem = {
            id: 'block',
            type: 'block-timer',
            metadata: {
                display: 'progress-short',
                invert: 'true'
            }
        };

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 13500000,
            remainingMs: 4500000,
            elapsedPercent: 75,
            remainingPercent: 25
        });

        expect(render(widget, item, { usageData: {} })).toBe('时段 [████░░░░░░░░░░░░] 25.0%');
    });

    it('renders empty values when no usage or fallback data exists', () => {
        const widget = new BlockTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue(null);

        expect(render(widget, { id: 'block', type: 'block-timer' }, { usageData: { error: 'timeout' } })).toBe('时段: 0时 0分');
        expect(render(widget, {
            id: 'block',
            type: 'block-timer',
            metadata: { display: 'progress' }
        }, { usageData: { error: 'timeout' } })).toBe(`时段 [${'░'.repeat(32)}] 0.0%`);
    });

    it('shows raw value without label in time mode', () => {
        const widget = new BlockTimerWidget();

        mockResolveUsageWindowWithFallback.mockReturnValue({
            sessionDurationMs: 18000000,
            elapsedMs: 7200000,
            remainingMs: 10800000,
            elapsedPercent: 40,
            remainingPercent: 60
        });
        mockFormatUsageDuration.mockReturnValue('2时');

        expect(render(widget, { id: 'block', type: 'block-timer', rawValue: true }, { usageData: {} })).toBe('2时');
    });

    runUsageTimerEditorSuite({
        baseItem: { id: 'block', type: 'block-timer' },
        createWidget: () => new BlockTimerWidget(),
        expectedDisplayName: '时段计时器',
        expectedModifierText: '(长进度条, 反转)',
        modifierItem: {
            id: 'block',
            type: 'block-timer',
            metadata: { display: 'progress', invert: 'true' }
        }
    });
});
