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
        // makeUsageProgressBar no longer used; SessionUsage uses makeTimerProgressBar directly
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
        }, context)).toBe('会话: ▓▓░░░│░░░░ 20.0%');
        expect(render(widget, {
            id: 'session',
            type: 'session-usage',
            metadata: { cursor: 'true', display: 'slider-only' }
        }, context)).toBe('会话: ▓▓░░░│░░░░');
    });

    runUsagePercentWidgetSuite({
        baseItem: { id: 'session', type: 'session-usage' },
        createWidget: () => new SessionUsageWidget(),
        errorMessageMock: usageErrorMessageMock,
        expectedInvertedTime: '会话: 76.5%',
        expectedModifierText: '(中进度条, 剩余)',
        expectedPreviewInvertedTime: '会话: 80.0%',
        expectedProgress: '会话: [████████████░░░░] 76.5%',
        expectedRawInvertedTime: '76.5%',
        expectedRawProgress: '[████████░░░░░░░░░░░░░░░░░░░░░░░░] 23.4%',
        expectedRawTime: '23.4%',
        expectedTime: '会话: 23.4%',
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
