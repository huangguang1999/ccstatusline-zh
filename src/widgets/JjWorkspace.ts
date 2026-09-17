import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';
import {
    isInsideJjRepo,
    runJjArgs
} from '../utils/jj';

import {
    NO_JJ_HIDEABLE_STATE,
    isHidden
} from './shared/hideable';
import {
    formatSymbolPrefix,
    getSymbolKeybind,
    renderSymbolOverrideEditor
} from './shared/symbol-override';

const CURRENT_WORKSPACE_TEMPLATE = 'if(target.current_working_copy(), name ++ "\n")';
const DEFAULT_SYMBOL = '◆';

export class JjWorkspaceWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示当前 Jujutsu 工作区名'; }
    getDisplayName(): string { return 'JJ 工作区'; }
    getCategory(): string { return 'Jujutsu'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_JJ_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const hideNoJj = isHidden(item, NO_JJ_HIDEABLE_STATE.key);
        const prefix = formatSymbolPrefix(item, DEFAULT_SYMBOL);

        if (context.isPreview) {
            return item.rawValue ? 'default' : `${prefix}default`;
        }

        if (!isInsideJjRepo(context)) {
            return hideNoJj ? null : '◆ 无 JJ';
        }

        const workspace = this.getJjWorkspace(context);
        if (workspace) {
            return item.rawValue ? workspace : `${prefix}${workspace}`;
        }

        return hideNoJj ? null : '◆ 无 JJ';
    }

    private getJjWorkspace(context: RenderContext): string | null {
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

    getCustomKeybinds(): CustomKeybind[] {
        return [getSymbolKeybind()];
    }

    renderEditor(props: WidgetEditorProps) {
        return renderSymbolOverrideEditor(props, DEFAULT_SYMBOL);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }
}
