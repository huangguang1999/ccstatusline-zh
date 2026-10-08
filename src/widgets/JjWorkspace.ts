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

const CURRENT_WORKSPACE_TEMPLATE = 'if(target.current_working_copy(), name ++ "\n")';
const DEFAULT_SYMBOL = '◆';

export class JjWorkspaceWidget extends JjWidgetBase {
    protected readonly previewValue = 'default';
    protected readonly noJjText = '无 JJ';

    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示当前 Jujutsu 工作区名'; }
    getDisplayName(): string { return 'JJ 工作区'; }

    protected getValue(context: RenderContext): string | null {
        const output = runJjArgs([
            'workspace',
            'list',
            '--template',
            CURRENT_WORKSPACE_TEMPLATE
        ], context);
        if (!output) {
            return null;
        }

        return output.split(/\r?\n/).map(workspace => workspace.trim()).find(Boolean) ?? null;
    }

    protected formatValue(item: WidgetItem, workspace: string): string {
        return formatRawOrLabeledValue(item, formatSymbolPrefix(item, DEFAULT_SYMBOL), workspace);
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
