import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    buildRepoWebUrl,
    getForkStatus,
    getRemoteInfo
} from '../utils/git-remote';
import { renderOsc8Link } from '../utils/hyperlink';

import { makeModifierText } from './shared/editor-display';
import {
    getRemoteWidgetKeybinds,
    handleRemoteWidgetAction,
    isHideNoRemoteEnabled,
    isLinkToRepoEnabled
} from './shared/git-remote';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';

const OWNER_ONLY_WHEN_FORK_KEY = 'ownerOnlyWhenFork';
const TOGGLE_OWNER_ONLY_ACTION = 'toggle-owner-only';

export class GitOriginOwnerRepoWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '以 所有者/仓库 形式显示 origin 远程'; }
    getDisplayName(): string { return 'Git Origin 所有者/仓库'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [];

        if (isHideNoRemoteEnabled(item)) {
            modifiers.push('空值时隐藏');
        }
        if (isLinkToRepoEnabled(item)) {
            modifiers.push('链接');
        }
        if (isMetadataFlagEnabled(item, OWNER_ONLY_WHEN_FORK_KEY)) {
            modifiers.push('Fork 时仅显示所有者');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: makeModifierText(modifiers)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === TOGGLE_OWNER_ONLY_ACTION) {
            return toggleMetadataFlag(item, OWNER_ONLY_WHEN_FORK_KEY);
        }

        return handleRemoteWidgetAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const hideWhenEmpty = isHideNoRemoteEnabled(item);
        const linkEnabled = isLinkToRepoEnabled(item);
        const ownerOnlyWhenFork = isMetadataFlagEnabled(item, OWNER_ONLY_WHEN_FORK_KEY);

        if (context.isPreview) {
            const text = ownerOnlyWhenFork ? 'owner' : 'owner/repo';
            return linkEnabled ? renderOsc8Link('https://github.com/owner/repo', text) : text;
        }

        const origin = getRemoteInfo('origin', context);
        if (!origin) {
            return hideWhenEmpty ? null : 'no remote';
        }

        const isFork = ownerOnlyWhenFork && getForkStatus(context).isFork;
        const text = isFork ? origin.owner : `${origin.owner}/${origin.repo}`;

        if (linkEnabled) {
            const url = buildRepoWebUrl(origin);
            return renderOsc8Link(url, text);
        }

        return text;
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            ...getRemoteWidgetKeybinds(),
            { key: 'o', label: '(o)wner only when fork', action: TOGGLE_OWNER_ONLY_ACTION }
        ];
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
