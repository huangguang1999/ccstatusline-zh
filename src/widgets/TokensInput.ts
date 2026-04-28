import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextWindowInputTotalTokens } from '../utils/context-window';
import { formatTokens } from '../utils/renderer';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

export class TokensInputWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示当前会话的输入 Token 数'; }
    getDisplayName(): string { return '输入 Token'; }
    getCategory(): string { return 'Token'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, '输入: ', '15.2k');
        }

        const inputTotalTokens = getContextWindowInputTotalTokens(context.data);
        if (inputTotalTokens !== null) {
            return formatRawOrLabeledValue(item, '输入: ', formatTokens(inputTotalTokens));
        }

        if (context.tokenMetrics) {
            return formatRawOrLabeledValue(item, '输入: ', formatTokens(context.tokenMetrics.inputTokens));
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
