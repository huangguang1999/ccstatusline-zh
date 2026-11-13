import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { formatTokens } from '../utils/format-tokens';
import { resolveNumberFormat } from '../utils/number-format';

import { isHidden } from './shared/hideable';
import {
    NO_MISSES_HIDEABLE_STATE,
    getPromptCache,
    hasNoMisses
} from './shared/prompt-cache';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '未命中重建: ';

export class CacheMissTokensWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示本会话因提示缓存未命中而重新写入缓存的 Token 数'; }
    getDisplayName(): string { return '缓存未命中 Token'; }
    getCategory(): string { return '缓存'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_MISSES_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const cache = getPromptCache(context);
        if (typeof cache?.miss_recache_tokens !== 'number') {
            return null;
        }

        if (hasNoMisses(cache) && isHidden(item, NO_MISSES_HIDEABLE_STATE.key)) {
            return null;
        }

        const value = formatTokens(cache.miss_recache_tokens, resolveNumberFormat('token', item, settings));
        return formatRawOrLabeledValue(item, LABEL, value);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
