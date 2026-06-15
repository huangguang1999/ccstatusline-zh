import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { loadClaudeSettingsSync } from '../utils/claude-settings';
import {
    getTranscriptThinkingEffort,
    normalizeThinkingEffort,
    type ResolvedThinkingEffort,
    type TranscriptThinkingEffort
} from '../utils/jsonl';

export type ThinkingEffortLevel = TranscriptThinkingEffort;

function resolveThinkingEffortFromStatusJson(context: RenderContext): ResolvedThinkingEffort | null | undefined {
    const effort = context.data?.effort;
    if (!effort || !('level' in effort)) {
        return undefined;
    }

    return typeof effort.level === 'string' ? normalizeThinkingEffort(effort.level) : null;
}

function resolveThinkingEffortFromSettings(): ResolvedThinkingEffort | undefined {
    try {
        const settings = loadClaudeSettingsSync({ logErrors: false });
        return normalizeThinkingEffort(settings.effortLevel);
    } catch {
        // Settings unavailable, return undefined
    }

    return undefined;
}

function resolveThinkingEffort(context: RenderContext): ResolvedThinkingEffort | null {
    const statusEffort = resolveThinkingEffortFromStatusJson(context);
    if (statusEffort !== undefined) {
        return statusEffort;
    }

    return getTranscriptThinkingEffort(context.data?.transcript_path)
        ?? resolveThinkingEffortFromSettings()
        ?? null;
}

function formatEffort(resolved: ResolvedThinkingEffort | null): string {
    if (!resolved) {
        return 'default';
    }
    return resolved.known ? resolved.value : `${resolved.value}?`;
}

export class ThinkingEffortWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return '显示当前思考力度级别（low, medium, high, xhigh, max）。\nClaude Code 将 Ultracode 报告为 xhigh，不作为单独的力度级别。\n未知级别会以末尾 "?" 标记显示（如 "super-max?"）。\n多个 Claude Code 会话同时运行时可能不准确。'; }
    getDisplayName(): string { return '思考力度'; }
    getCategory(): string { return '核心'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'high' : '思考: high';
        }

        const effort = formatEffort(resolveThinkingEffort(context));
        return item.rawValue ? effort : `思考: ${effort}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
