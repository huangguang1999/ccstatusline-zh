import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class VersionWidget implements Widget {
    getDefaultColor(): string { return 'gray'; }
    getDescription(): string { return '显示 Claude Code CLI 版本号'; }
    getDisplayName(): string { return '版本'; }
    getCategory(): string { return '核心'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '1.0.0' : 'v1.0.0';
        } else if (context.data?.version) {
            return item.rawValue ? context.data.version : `v${context.data.version}`;
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
