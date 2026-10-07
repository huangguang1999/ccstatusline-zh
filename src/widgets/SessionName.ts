import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getTranscriptSessionName } from '../utils/jsonl-session';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '会话: ';

export class SessionNameWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示通过 /rename 命令设置的会话名称'; }
    getDisplayName(): string { return '会话名称'; }
    getCategory(): string { return '会话'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), 'my-session');
        }

        const sessionName = context.transcriptSessionName === undefined
            ? getTranscriptSessionName(context.data?.transcript_path)
            : context.transcriptSessionName;
        if (sessionName === null) {
            return null;
        }

        return formatRawOrLabeledValue(item, this.getLabelPrefix(), sessionName);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
