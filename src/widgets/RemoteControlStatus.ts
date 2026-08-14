import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getRemoteControlStatus } from '../utils/claude-settings';

import {
    isNerdFontEnabled,
    setNerdFontFormat,
    toggleNerdFont,
    type NerdFontFormats
} from './shared/metadata';

const SATELLITE_EMOJI = '📡';
const SATELLITE_NERD_FONT = '';
const SATELLITE_SLASH_NERD_FONT = '';
const STATE_DOT_OFF = '○';
const STATE_DOT_ON = '◉';

const FORMATS = ['icon', 'icon-text', 'text', 'word', 'label-check', 'label-mark'] as const;
const CHECK_EMOJI = '✅';
const CROSS_EMOJI = '❌';
const CHECK_MARK = '✓';
const CROSS_MARK = '✗';
type RemoteFormat = typeof FORMATS[number];

const DEFAULT_FORMAT: RemoteFormat = 'icon';
const CYCLE_FORMAT_ACTION = 'cycle-format';
const TOGGLE_NERD_FONT_ACTION = 'toggle-nerd-font';

function getFormat(item: WidgetItem): RemoteFormat {
    const f = item.metadata?.format;
    return (FORMATS as readonly string[]).includes(f ?? '') ? (f as RemoteFormat) : DEFAULT_FORMAT;
}

function canUseNerdFont(item: WidgetItem): boolean {
    const format = getFormat(item);
    return format === 'icon' || (format === 'icon-text' && !item.rawValue);
}

const NERD_FONT_FORMATS: NerdFontFormats<RemoteFormat> = {
    defaultFormat: DEFAULT_FORMAT,
    canUseNerdFont
};

function formatStatus(enabled: boolean, format: RemoteFormat, nerdFont: boolean, rawValue: boolean): string {
    const stateText = rawValue
        ? (enabled ? 'on' : 'off')
        : (enabled ? '启用' : '关闭');
    const stateDot = enabled ? STATE_DOT_ON : STATE_DOT_OFF;
    const icon = nerdFont
        ? (enabled ? SATELLITE_NERD_FONT : SATELLITE_SLASH_NERD_FONT)
        : SATELLITE_EMOJI;

    switch (format) {
        case 'icon':
            return nerdFont ? icon : (rawValue ? stateDot : `${icon} ${stateDot}`);
        case 'icon-text':
            return rawValue ? stateText : `${icon} ${stateText}`;
        case 'text':
            return stateText;
        case 'word':
            return rawValue ? stateText : `远程 ${stateText}`;
        case 'label-check':
            return rawValue ? (enabled ? CHECK_EMOJI : CROSS_EMOJI) : `远程 ${enabled ? CHECK_EMOJI : CROSS_EMOJI}`;
        case 'label-mark':
            return rawValue ? (enabled ? CHECK_MARK : CROSS_MARK) : `远程 ${enabled ? CHECK_MARK : CROSS_MARK}`;
    }
}

export class RemoteControlStatusWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示 Claude Code 远程控制是否已连接到当前会话'; }
    getDisplayName(): string { return '远程控制状态'; }
    getCategory(): string { return '核心'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [getFormat(item)];
        if (isNerdFontEnabled(item, NERD_FONT_FORMATS)) {
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

            return setNerdFontFormat(item, nextFormat, NERD_FONT_FORMATS);
        }

        if (action === TOGGLE_NERD_FONT_ACTION) {
            return toggleNerdFont(item, NERD_FONT_FORMATS);
        }

        return null;
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const format = getFormat(item);
        const nerdFont = isNerdFontEnabled(item, NERD_FONT_FORMATS);

        if (context.isPreview) {
            return formatStatus(true, format, nerdFont, item.rawValue ?? false);
        }

        const status = getRemoteControlStatus(context.data?.session_id);
        if (status === null) {
            return null;
        }

        return formatStatus(status.enabled, format, nerdFont, item.rawValue ?? false);
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
