import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import {
    formatTokensWithPercentage,
    getCacheReadPercentage,
    getCacheTokens
} from './shared/cache-metrics';
import {
    getCacheKeybinds,
    getCacheModifierText,
    handleCacheOptionsAction,
    isCacheHideWhenEmptyEnabled,
    isCacheSessionScope
} from './shared/cache-scope';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

export class CacheReadWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示从缓存中读取的令牌数及其上下文占比'; }
    getDisplayName(): string { return '缓存读取'; }
    getCategory(): string { return '缓存'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName(), modifierText: getCacheModifierText(item) };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return handleCacheOptionsAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, 'Cache Read: ', '12k (64.0%)');
        }

        const hideWhenEmpty = isCacheHideWhenEmptyEnabled(item);
        const tokens = getCacheTokens(context, isCacheSessionScope(item));
        if (!tokens) {
            return hideWhenEmpty ? null : formatRawOrLabeledValue(item, 'Cache Read: ', 'n/a');
        }

        if (tokens.read === 0 && hideWhenEmpty) {
            return null;
        }

        const value = formatTokensWithPercentage(tokens.read, getCacheReadPercentage(tokens));
        return formatRawOrLabeledValue(item, 'Cache Read: ', value);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        return getCacheKeybinds();
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
