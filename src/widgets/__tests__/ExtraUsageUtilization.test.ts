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
import { ExtraUsageUtilizationWidget } from '../ExtraUsageUtilization';

let mockGetUsageErrorMessage: { mockReturnValue: (value: string) => void };

function render(widget: ExtraUsageUtilizationWidget, item: WidgetItem, context: RenderContext = {}): string | null {
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('ExtraUsageUtilizationWidget', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockGetUsageErrorMessage = vi.spyOn(usage, 'getUsageErrorMessage');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders utilization text and bar modes', () => {
        const widget = new ExtraUsageUtilizationWidget();
        const context: RenderContext = {
            usageData: {
                extraUsageEnabled: true,
                extraUsageUtilization: 0.25
            }
        };

        expect(render(widget, { id: 'extra', type: 'extra-usage-utilization' }, context)).toBe('超额: 25.0%');
        expect(render(widget, {
            id: 'extra',
            rawValue: true,
            type: 'extra-usage-utilization'
        }, context)).toBe('25.0%');
        expect(render(widget, {
            id: 'extra',
            metadata: { display: 'progress-short' },
            type: 'extra-usage-utilization'
        }, context)).toBe('超额: [████░░░░░░░░░░░░] 25.0%');
        expect(render(widget, {
            id: 'extra',
            metadata: { display: 'slider-only' },
            type: 'extra-usage-utilization'
        }, context)).toBe('超额: ▓▓▓░░░░░░░');
    });

    it('renders available utilization before unrelated usage errors', () => {
        const widget = new ExtraUsageUtilizationWidget();

        expect(render(widget, { id: 'extra', type: 'extra-usage-utilization' }, {
            usageData: {
                error: 'timeout',
                extraUsageEnabled: true,
                extraUsageUtilization: 0.026
            }
        })).toBe('超额: 2.6%');
    });

    it('exposes and toggles hide-if-disabled configuration', () => {
        const widget = new ExtraUsageUtilizationWidget();
        const baseItem: WidgetItem = { id: 'extra', type: 'extra-usage-utilization' };

        expect(widget.getCustomKeybinds(baseItem)).toEqual([
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 'h', label: '(h)禁用时隐藏', action: 'toggle-hide-disabled' }
        ]);
        expect(widget.getCustomKeybinds({
            ...baseItem,
            metadata: { display: 'progress' }
        })).toEqual([
            { key: 'p', label: '(p)进度条切换', action: 'toggle-progress' },
            { key: 'v', label: '(v)反转填充', action: 'toggle-invert' },
            { key: 't', label: '(t)时间游标', action: 'toggle-cursor' },
            { key: 'h', label: '(h)禁用时隐藏', action: 'toggle-hide-disabled' }
        ]);
        expect(widget.getEditorDisplay(baseItem).modifierText).toBeUndefined();

        const hidden = widget.handleEditorAction('toggle-hide-disabled', baseItem);
        expect(hidden?.metadata?.hideIfDisabled).toBe('true');
        expect(widget.getEditorDisplay(hidden ?? baseItem).modifierText).toBe('(禁用时隐藏)');
        expect(widget.getEditorDisplay({
            ...baseItem,
            metadata: { display: 'progress', hideIfDisabled: 'true' }
        }).modifierText).toBe('(长进度条, 禁用时隐藏)');

        const shown = widget.handleEditorAction('toggle-hide-disabled', hidden ?? baseItem);
        expect(shown?.metadata?.hideIfDisabled).toBe('false');
    });

    it('shows usage errors only when required extra usage data is missing', () => {
        const widget = new ExtraUsageUtilizationWidget();

        mockGetUsageErrorMessage.mockReturnValue('[超时]');

        expect(render(widget, { id: 'extra', type: 'extra-usage-utilization' }, { usageData: { error: 'timeout' } })).toBe('[超时]');
        expect(render(widget, { id: 'extra', type: 'extra-usage-utilization' }, { usageData: { extraUsageEnabled: true } })).toBeNull();
    });

    it('renders n/a when extra usage is disabled', () => {
        const widget = new ExtraUsageUtilizationWidget();

        expect(render(widget, { id: 'extra', type: 'extra-usage-utilization' }, {
            usageData: {
                error: 'timeout',
                extraUsageEnabled: false,
                extraUsageUtilization: 0.25
            }
        })).toBe('超额: n/a');
        const rawProgressItem: WidgetItem = {
            id: 'extra',
            metadata: { display: 'progress-short' },
            rawValue: true,
            type: 'extra-usage-utilization'
        };

        expect(render(widget, rawProgressItem, { usageData: { extraUsageEnabled: false } })).toBe('n/a');
    });

    it('hides when extra usage is disabled and hide-if-disabled is enabled', () => {
        const widget = new ExtraUsageUtilizationWidget();

        const hiddenItem: WidgetItem = {
            id: 'extra',
            metadata: { hideIfDisabled: 'true' },
            type: 'extra-usage-utilization'
        };

        expect(render(widget, hiddenItem, { usageData: { extraUsageEnabled: false } })).toBeNull();
    });

    it('inverts bar rendering', () => {
        const widget = new ExtraUsageUtilizationWidget();

        expect(render(widget, {
            id: 'extra',
            metadata: { display: 'progress-short', invert: 'true' },
            type: 'extra-usage-utilization'
        }, {
            usageData: {
                extraUsageEnabled: true,
                extraUsageUtilization: 0.25
            }
        })).toBe('超额: [████████████░░░░] 75.0%');
    });
});
