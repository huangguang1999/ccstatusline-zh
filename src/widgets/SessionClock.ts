import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import { isHidden } from './shared/hideable';

const ZERO_HIDEABLE_STATE: HideableState = { key: 'zero', label: '不足 1 分钟时' };

function formatDurationFromMs(durationMs: number): string {
    const totalMinutes = Math.floor(durationMs / (1000 * 60));

    if (totalMinutes < 1) {
        return '<1分';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}分`;
    }
    if (minutes === 0) {
        return `${hours}时`;
    }

    return `${hours}时 ${minutes}分`;
}

export class SessionClockWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示当前会话已经过的时间'; }
    getDisplayName(): string { return '会话时钟'; }
    getCategory(): string { return '会话'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [ZERO_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '2时 15分' : '会话: 2时 15分';
        }

        const hideZero = isHidden(item, ZERO_HIDEABLE_STATE.key);

        const durationMs = context.data?.cost?.total_duration_ms;
        if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0) {
            if (durationMs < 60000 && hideZero) {
                return null;
            }
            const formatted = formatDurationFromMs(durationMs);
            return item.rawValue ? formatted : `会话: ${formatted}`;
        }

        const duration = context.sessionDuration ?? '0分';
        if (['0m', '<1m', '0分', '<1分'].includes(duration) && hideZero) {
            return null;
        }
        return item.rawValue ? duration : `会话: ${duration}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
