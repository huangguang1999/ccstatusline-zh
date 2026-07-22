import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getSandboxConfig } from '../utils/claude-settings';

const DOT_ON = '●';
const DOT_OFF = '○';
const LOCK_NERD_FONT = '';
const UNLOCK_NERD_FONT = '';

const FORMATS = ['glyph', 'text', 'word'] as const;
type SandboxFormat = typeof FORMATS[number];

const DEFAULT_FORMAT: SandboxFormat = 'glyph';
const CYCLE_FORMAT_ACTION = 'cycle-format';
const TOGGLE_NERD_FONT_ACTION = 'toggle-nerd-font';
const NERD_FONT_METADATA_KEY = 'nerdFont';

function getFormat(item: WidgetItem): SandboxFormat {
    const f = item.metadata?.format;
    return (FORMATS as readonly string[]).includes(f ?? '') ? (f as SandboxFormat) : DEFAULT_FORMAT;
}

function canUseNerdFont(item: WidgetItem): boolean {
    return getFormat(item) === 'glyph';
}

function removeNerdFont(item: WidgetItem): WidgetItem {
    const { [NERD_FONT_METADATA_KEY]: removedNerdFont, ...restMetadata } = item.metadata ?? {};
    void removedNerdFont;

    return {
        ...item,
        metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined
    };
}

function setFormat(item: WidgetItem, format: SandboxFormat): WidgetItem {
    let updatedItem: WidgetItem;

    if (format === DEFAULT_FORMAT) {
        const { format: removedFormat, ...restMetadata } = item.metadata ?? {};
        void removedFormat;

        updatedItem = {
            ...item,
            metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined
        };
    } else {
        updatedItem = {
            ...item,
            metadata: {
                ...(item.metadata ?? {}),
                format
            }
        };
    }

    return canUseNerdFont(updatedItem) ? updatedItem : removeNerdFont(updatedItem);
}

function isNerdFontEnabled(item: WidgetItem): boolean {
    return canUseNerdFont(item) && item.metadata?.[NERD_FONT_METADATA_KEY] === 'true';
}

function toggleNerdFont(item: WidgetItem): WidgetItem {
    if (!canUseNerdFont(item)) {
        return removeNerdFont(item);
    }

    if (!isNerdFontEnabled(item)) {
        return {
            ...item,
            metadata: {
                ...(item.metadata ?? {}),
                [NERD_FONT_METADATA_KEY]: 'true'
            }
        };
    }

    return removeNerdFont(item);
}

function formatStatus(enabled: boolean, format: SandboxFormat, nerdFont: boolean, rawValue: boolean): string {
    const rawStateText = enabled ? 'ON' : 'OFF';
    const displayStateText = enabled ? '启用' : '关闭';
    const glyph = nerdFont
        ? (enabled ? LOCK_NERD_FONT : UNLOCK_NERD_FONT)
        : (enabled ? DOT_ON : DOT_OFF);

    switch (format) {
        case 'glyph':
            return rawValue ? glyph : `SB: ${glyph}`;
        case 'text':
            return rawValue ? rawStateText : `SB: ${displayStateText}`;
        case 'word':
            return rawValue ? rawStateText : `沙箱: ${displayStateText}`;
    }
}

function resolveSandboxConfigCwd(context: RenderContext): string | undefined {
    const candidates = [
        context.data?.workspace?.project_dir,
        context.data?.cwd,
        context.data?.workspace?.current_dir
    ];

    return candidates.find(candidate => typeof candidate === 'string' && candidate.trim().length > 0);
}

export class SandboxStatusWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string {
        return [
            '显示 Claude Code Bash 沙箱模式是否启用',
            '尽力检测：受管理策略或 CLI 设置覆盖、沙箱初始化失败时，结果可能与实际状态不一致。'
        ].join('\n');
    }

    getDisplayName(): string { return '沙箱状态'; }
    getCategory(): string { return '核心'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [getFormat(item)];
        if (isNerdFontEnabled(item)) {
            modifiers.push('Nerd 字体');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: `(${modifiers.join(', ')})`
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === CYCLE_FORMAT_ACTION) {
            const currentFormat = getFormat(item);
            const nextFormat = FORMATS[(FORMATS.indexOf(currentFormat) + 1) % FORMATS.length] ?? DEFAULT_FORMAT;

            return setFormat(item, nextFormat);
        }

        if (action === TOGGLE_NERD_FONT_ACTION) {
            return toggleNerdFont(item);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const format = getFormat(item);
        const nerdFont = isNerdFontEnabled(item);

        if (context.isPreview) {
            return formatStatus(true, format, nerdFont, item.rawValue ?? false);
        }

        const config = getSandboxConfig(resolveSandboxConfigCwd(context));
        if (config === null) {
            return null;
        }

        return formatStatus(config.enabled, format, nerdFont, item.rawValue ?? false);
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        const keybinds: CustomKeybind[] = [
            { key: 'f', label: '(f)显示格式', action: CYCLE_FORMAT_ACTION }
        ];
        if (item === undefined || canUseNerdFont(item)) {
            keybinds.push({ key: 'n', label: '(n)Nerd 字体', action: TOGGLE_NERD_FONT_ACTION });
        }
        return keybinds;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
