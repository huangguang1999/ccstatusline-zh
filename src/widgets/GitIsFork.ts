import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getForkStatus } from '../utils/git-remote';

import { makeModifierText } from './shared/editor-display';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';

const HIDE_WHEN_NOT_FORK_KEY = 'hideWhenNotFork';
const TOGGLE_HIDE_ACTION = 'toggle-hide';

export class GitIsForkWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '当仓库是 upstream 的 fork 时显示标识'; }
    getDisplayName(): string { return 'Git 是否 Fork'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [];

        if (isMetadataFlagEnabled(item, HIDE_WHEN_NOT_FORK_KEY)) {
            modifiers.push('非 Fork 时隐藏');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: makeModifierText(modifiers)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === TOGGLE_HIDE_ACTION) {
            return toggleMetadataFlag(item, HIDE_WHEN_NOT_FORK_KEY);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const hideWhenNotFork = isMetadataFlagEnabled(item, HIDE_WHEN_NOT_FORK_KEY);

        if (context.isPreview) {
            return item.rawValue ? 'true' : 'isFork: true';
        }

        const forkStatus = getForkStatus(context);

        if (forkStatus.isFork) {
            return item.rawValue ? 'true' : 'isFork: true';
        }

        // Not a fork
        if (hideWhenNotFork) {
            return null;
        }

        return item.rawValue ? 'false' : 'isFork: false';
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'h', label: '(h)ide when not fork', action: TOGGLE_HIDE_ACTION }
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
