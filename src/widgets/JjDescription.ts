import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
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

export class JjDescriptionWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return '显示当前 Jujutsu 变更描述'; }
    getDisplayName(): string { return 'JJ 变更描述'; }
    getCategory(): string { return 'Jujutsu'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_JJ_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const hideNoJj = isHidden(item, NO_JJ_HIDEABLE_STATE.key);

        if (context.isPreview) {
            return '(无描述)';
        }

        if (!isInsideJjRepo(context)) {
            return hideNoJj ? null : '无 JJ';
        }

        const description = runJjArgs([
            'log',
            '--no-graph',
            '-r',
            '@',
            '-T',
            'description.first_line()'
        ], context, true);
        if (description === null) {
            return hideNoJj ? null : '无 JJ';
        }

        return description.length > 0 ? description : '(无描述)';
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
