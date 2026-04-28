import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class GitWorktreeBranchWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '当前工作树的 Git 分支名'; }
    getDisplayName(): string { return 'Git 工作树分支'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            return 'wt-my-feature';
        }

        const branch = context.data?.worktree?.branch;
        return branch ?? null;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
