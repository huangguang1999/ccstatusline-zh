import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import {
    formatMissAge,
    formatMissCause,
    getPromptCache
} from './shared/prompt-cache';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '最近未命中: ';

// Renders nothing until the session's first miss, so it needs no hide option
export class LastCacheMissWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示 Claude Code 报告的最近提示缓存未命中时间及可能原因'; }
    getDisplayName(): string { return '最近缓存未命中'; }
    getCategory(): string { return '缓存'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const cache = getPromptCache(context);
        if (typeof cache?.last_miss_at !== 'number') {
            return null;
        }

        const raw = `${formatMissAge(cache.last_miss_at, Date.now(), !!item.rawValue)}, ${formatMissCause(cache.last_miss_cause)}`;
        const value = item.rawValue ? raw : raw
            .replace(/(\d+)h/g, '$1时')
            .replace(/(\d+)m/g, '$1分')
            .replace('tools changed', '工具变更')
            .replace('system prompt changed', '系统提示词变更')
            .replace(' chars', ' 字符')
            .replace('TTL expired', 'TTL 已过期')
            .replace('cause unknown', '原因未知')
            .replace('likely server side', '可能由服务端引起');
        return formatRawOrLabeledValue(item, LABEL, value);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
