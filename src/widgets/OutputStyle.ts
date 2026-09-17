import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import { isHidden } from './shared/hideable';

const DEFAULT_VALUE_HIDEABLE_STATE: HideableState = { key: 'default-value', label: '输出风格为默认时' };

export class OutputStyleWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示当前 Claude Code 输出风格'; }
    getDisplayName(): string { return '输出风格'; }
    getCategory(): string { return '核心'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [DEFAULT_VALUE_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'default' : '风格: default';
        } else if (context.data?.output_style?.name) {
            const styleName = context.data.output_style.name;
            if (styleName === 'default' && isHidden(item, DEFAULT_VALUE_HIDEABLE_STATE.key)) {
                return null;
            }
            return item.rawValue ? styleName : `风格: ${styleName}`;
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
