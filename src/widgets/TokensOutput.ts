import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextWindowOutputTotalTokens } from '../utils/context-window';
import { resolveNumberFormat } from '../utils/number-format';
import { formatTokens } from '../utils/renderer';

import { isHidden } from './shared/hideable';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const ZERO_HIDEABLE_STATE: HideableState = { key: 'zero', label: 'Token 数为零时' };

export class TokensOutputWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return '显示当前会话的输出 Token 数'; }
    getDisplayName(): string { return '输出 Token'; }
    getCategory(): string { return 'Token'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [ZERO_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const format = resolveNumberFormat('token', item, settings);
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, '输出: ', formatTokens(3400, format));
        }

        const outputTotalTokens = context.tokenMetrics?.outputTokens
            ?? getContextWindowOutputTotalTokens(context.data)
            ?? null;
        if (outputTotalTokens === null) {
            return null;
        }

        if (outputTotalTokens === 0 && isHidden(item, ZERO_HIDEABLE_STATE.key)) {
            return null;
        }

        return formatRawOrLabeledValue(item, '输出: ', formatTokens(outputTotalTokens, format));
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
