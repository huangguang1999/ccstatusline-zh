import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '模型: ';

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示当前 Claude 模型名称（如 Claude 3.5 Sonnet）'; }
    getDisplayName(): string { return '模型'; }
    getCategory(): string { return '核心'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), 'Claude');
        }

        const model = context.data?.model;
        const modelDisplayName = typeof model === 'string'
            ? model
            : (model?.display_name ?? model?.id);

        if (modelDisplayName) {
            const shortName = modelDisplayName.replace(/\s*\(.*\)$/, '');
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), shortName);
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
