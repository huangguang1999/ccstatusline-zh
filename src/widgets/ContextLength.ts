import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextWindowContextLengthTokens } from '../utils/context-window';
import { resolveNumberFormat } from '../utils/number-format';
import { formatTokens } from '../utils/renderer';

export class ContextLengthWidget implements Widget {
    getDefaultColor(): string { return 'brightBlack'; }
    getDescription(): string { return '显示当前上下文窗口大小（Token 数）'; }
    getDisplayName(): string { return '上下文长度'; }
    getCategory(): string { return '上下文'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const format = resolveNumberFormat('token', item, settings);
        if (context.isPreview) {
            const value = formatTokens(18600, format);
            return item.rawValue ? value : `上下文: ${value}`;
        }

        const contextLengthTokens = getContextWindowContextLengthTokens(context.data);
        if (contextLengthTokens !== null) {
            return item.rawValue ? formatTokens(contextLengthTokens, format) : `上下文: ${formatTokens(contextLengthTokens, format)}`;
        }

        if (context.tokenMetrics) {
            return item.rawValue ? formatTokens(context.tokenMetrics.contextLength, format) : `上下文: ${formatTokens(context.tokenMetrics.contextLength, format)}`;
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
