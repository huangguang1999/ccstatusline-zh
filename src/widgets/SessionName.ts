import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getTranscriptSessionName } from '../utils/jsonl-session';

export class SessionNameWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示通过 /rename 命令设置的会话名称'; }
    getDisplayName(): string { return '会话名称'; }
    getCategory(): string { return '会话'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'my-session' : '会话: my-session';
        }

        const sessionName = context.transcriptSessionName === undefined
            ? getTranscriptSessionName(context.data?.transcript_path)
            : context.transcriptSessionName;
        if (sessionName === null) {
            return null;
        }

        return item.rawValue ? sessionName : `会话: ${sessionName}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
