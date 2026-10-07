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
import { getForkStatus } from '../utils/git-remote';

import { isHidden } from './shared/hideable';
import {
    getSymbol,
    getSymbolKeybind,
    renderSymbolOverrideEditor
} from './shared/symbol-override';

const DEFAULT_SYMBOL = '⑂';
const NOT_FORK_HIDEABLE_STATE: HideableState = { key: 'not-fork', label: '仓库不是 Fork 时' };

export class GitIsForkWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '当仓库是 upstream 的 fork 时显示标识'; }
    getDisplayName(): string { return 'Git 是否 Fork'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NOT_FORK_HIDEABLE_STATE];
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [getSymbolKeybind()];
    }

    renderEditor(props: WidgetEditorProps) {
        return renderSymbolOverrideEditor(props, DEFAULT_SYMBOL);
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const symbol = getSymbol(item, DEFAULT_SYMBOL);

        if (context.isPreview) {
            return item.rawValue ? 'true' : symbol;
        }

        const forkStatus = getForkStatus(context);

        if (forkStatus.isFork) {
            return item.rawValue ? 'true' : symbol;
        }

        // Not a fork
        if (isHidden(item, NOT_FORK_HIDEABLE_STATE.key)) {
            return null;
        }

        return item.rawValue ? 'false' : 'isFork: false';
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
