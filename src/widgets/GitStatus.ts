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
    getGitStatus,
    isInsideGitWorkTree
} from '../utils/git';

import {
    NO_GIT_HIDEABLE_STATE,
    isHidden
} from './shared/hideable';
import {
    getSlotSymbol,
    getSymbolKeybind,
    renderSymbolSlotsEditor,
    type SymbolSlot
} from './shared/symbol-override';

const CONFLICTS_SLOT: SymbolSlot = { id: 'symbolConflicts', label: '冲突', defaultSymbol: '!' };
const STAGED_SLOT: SymbolSlot = { id: 'symbolStaged', label: '已暂存', defaultSymbol: '+' };
const UNSTAGED_SLOT: SymbolSlot = { id: 'symbolUnstaged', label: '未暂存', defaultSymbol: '*' };
const UNTRACKED_SLOT: SymbolSlot = { id: 'symbolUntracked', label: '未追踪', defaultSymbol: '?' };

export class GitStatusWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示 Git 状态指示：+ 已暂存, * 未暂存, ? 未跟踪, ! 冲突'; }
    getDisplayName(): string { return 'Git 状态'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_GIT_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const hideNoGit = isHidden(item, NO_GIT_HIDEABLE_STATE.key);

        if (context.isPreview) {
            return this.formatStatus(item, { staged: true, unstaged: true, untracked: false, conflicts: false });
        }

        if (!isInsideGitWorkTree(context)) {
            return hideNoGit ? null : '（无 Git）';
        }

        const status = getGitStatus(context);

        // Hide if clean
        if (!status.staged && !status.unstaged && !status.untracked && !status.conflicts) {
            return null;
        }

        return this.formatStatus(item, status);
    }

    private formatStatus(item: WidgetItem, status: { staged: boolean; unstaged: boolean; untracked: boolean; conflicts: boolean }): string {
        const parts: string[] = [];
        if (status.conflicts)
            parts.push(getSlotSymbol(item, CONFLICTS_SLOT));
        if (status.staged)
            parts.push(getSlotSymbol(item, STAGED_SLOT));
        if (status.unstaged)
            parts.push(getSlotSymbol(item, UNSTAGED_SLOT));
        if (status.untracked)
            parts.push(getSlotSymbol(item, UNTRACKED_SLOT));

        return parts.join('');
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [getSymbolKeybind()];
    }

    renderEditor(props: WidgetEditorProps) {
        return renderSymbolSlotsEditor(props, [CONFLICTS_SLOT, STAGED_SLOT, UNSTAGED_SLOT, UNTRACKED_SLOT]);
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
