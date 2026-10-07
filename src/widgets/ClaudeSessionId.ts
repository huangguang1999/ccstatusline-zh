import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '会话 ID: ';

export class ClaudeSessionIdWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示状态 JSON 中的当前 Claude Code 会话 ID'; }
    getDisplayName(): string { return 'Claude 会话 ID'; }
    getCategory(): string { return '核心'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), 'preview-session-id');
        } else {
            const sessionId = context.data?.session_id;
            if (!sessionId) {
                return null;
            }
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), sessionId);
        }
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
