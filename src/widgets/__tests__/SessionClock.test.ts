import {
    describe,
    expect,
    it
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { SessionClockWidget } from '../SessionClock';

function render(item: WidgetItem, context: RenderContext = {}): string | null {
    const widget = new SessionClockWidget();
    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('SessionClockWidget', () => {
    it('uses cost.total_duration_ms when available', () => {
        expect(render(
            { id: 'session-clock', type: 'session-clock' },
            { data: { cost: { total_duration_ms: 2 * 60 * 60 * 1000 + 15 * 60 * 1000 } } }
        )).toBe('会话: 2时 15分');
    });

    it('supports raw value with cost.total_duration_ms', () => {
        expect(render(
            { id: 'session-clock', type: 'session-clock', rawValue: true },
            { data: { cost: { total_duration_ms: 30 * 1000 } } }
        )).toBe('<1分');
    });

    it('falls back to sessionDuration when status JSON duration is missing', () => {
        expect(render(
            { id: 'session-clock', type: 'session-clock' },
            { sessionDuration: '3时 20分' }
        )).toBe('会话: 3时 20分');
    });

    it('declares the zero hideable state', () => {
        expect(new SessionClockWidget().getHideableStates().map(state => state.key)).toEqual(['zero']);
    });

    it('hides sub-minute durations only when the zero hide state is enabled', () => {
        const context: RenderContext = { data: { cost: { total_duration_ms: 30 * 1000 } } };

        expect(render({ id: 'session-clock', type: 'session-clock' }, context)).toBe('会话: <1分');
        expect(render({
            id: 'session-clock',
            type: 'session-clock',
            metadata: { hide: 'zero' }
        }, context)).toBeNull();
        expect(render({
            id: 'session-clock',
            type: 'session-clock',
            metadata: { hide: 'zero' }
        }, { data: { cost: { total_duration_ms: 90 * 1000 } } })).toBe('会话: 1分');
    });

    it('hides the 0m fallback duration when the zero hide state is enabled', () => {
        expect(render({
            id: 'session-clock',
            type: 'session-clock',
            metadata: { hide: 'zero' }
        }, {})).toBeNull();
    });

    it('hides transcript-derived sub-minute durations when the zero hide state is enabled', () => {
        const context: RenderContext = { sessionDuration: '<1m' };

        expect(render({ id: 'session-clock', type: 'session-clock' }, context)).toBe('会话: <1m');
        expect(render({
            id: 'session-clock',
            type: 'session-clock',
            metadata: { hide: 'zero' }
        }, context)).toBeNull();
    });
});
