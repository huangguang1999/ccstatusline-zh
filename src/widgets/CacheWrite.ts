import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { resolveNumberFormat } from '../utils/number-format';

import {
    formatTokensWithPercentage,
    getCacheTokens,
    getCacheWritePercentage
} from './shared/cache-metrics';
import {
    CACHE_EMPTY_HIDEABLE_STATE,
    getCacheKeybinds,
    getCacheModifierText,
    handleCacheOptionsAction,
    isCacheSessionScope
} from './shared/cache-scope';
import { isHidden } from './shared/hideable';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

export class CacheWriteWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示写入缓存的缓存写入令牌数及其上下文占比'; }
    getDisplayName(): string { return '缓存写入'; }
    getCategory(): string { return '缓存'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName(), modifierText: getCacheModifierText(item) };
    }

    getHideableStates(): HideableState[] {
        return [CACHE_EMPTY_HIDEABLE_STATE];
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return handleCacheOptionsAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const tokenFormat = resolveNumberFormat('token', item, settings);
        const percentFormat = resolveNumberFormat('percent', item, settings);
        if (context.isPreview) {
            const value = formatTokensWithPercentage(3000, 16, tokenFormat, percentFormat);
            return formatRawOrLabeledValue(item, '缓存写入: ', value);
        }

        const hideWhenEmpty = isHidden(item, CACHE_EMPTY_HIDEABLE_STATE.key);
        const tokens = getCacheTokens(context, isCacheSessionScope(item));
        if (!tokens) {
            return hideWhenEmpty ? null : formatRawOrLabeledValue(item, '缓存写入: ', 'n/a');
        }

        if (tokens.creation === 0 && hideWhenEmpty) {
            return null;
        }

        const value = formatTokensWithPercentage(tokens.creation, getCacheWritePercentage(tokens), tokenFormat, percentFormat);
        return formatRawOrLabeledValue(item, '缓存写入: ', value);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        return getCacheKeybinds();
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
