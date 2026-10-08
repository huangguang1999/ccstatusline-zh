import type { RenderContext } from '../types/RenderContext';
import type {
    CustomKeybind,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';
import { runJjArgs } from '../utils/jj';

import { JjWidgetBase } from './shared/jj-widget-base';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import {
    formatSymbolPrefix,
    getSymbolKeybind,
    renderSymbolOverrideEditor
} from './shared/symbol-override';

const DEFAULT_SYMBOL = '';

export class JjRevisionWidget extends JjWidgetBase {
    protected readonly previewValue = 'kkmpptxz';
    protected readonly noJjText = '无 JJ';

    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示当前 Jujutsu 变更 ID（短）'; }
    getDisplayName(): string { return 'JJ 修订'; }

    protected getValue(context: RenderContext): string | null {
        return runJjArgs([
            'log',
            '--no-graph',
            '-r',
            '@',
            '-T',
            'change_id.shortest()'
        ], context);
    }

    protected formatValue(item: WidgetItem, changeId: string): string {
        return formatRawOrLabeledValue(item, formatSymbolPrefix(item, DEFAULT_SYMBOL), changeId);
    }

    protected override formatPlaceholder(item: WidgetItem, text: string): string {
        return `${formatSymbolPrefix(item, DEFAULT_SYMBOL)}${text}`;
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [getSymbolKeybind()];
    }

    renderEditor(props: WidgetEditorProps) {
        return renderSymbolOverrideEditor(props, DEFAULT_SYMBOL);
    }

    supportsRawValue(): boolean { return true; }
}
