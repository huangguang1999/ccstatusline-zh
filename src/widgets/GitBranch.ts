import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    isInsideGitWorkTree,
    runGit
} from '../utils/git';
import {
    buildBranchWebUrl,
    getRemoteInfo
} from '../utils/git-remote';
import {
    encodeGitRefForUrlPath,
    renderOsc8Link
} from '../utils/hyperlink';

import { makeModifierText } from './shared/editor-display';
import {
    getHideNoGitKeybinds,
    getHideNoGitModifierText,
    handleToggleNoGitAction,
    isHideNoGitEnabled
} from './shared/git-no-git';
import { isMetadataFlagEnabled } from './shared/metadata';

const LINK_KEY = 'linkToRepo';
const LEGACY_LINK_KEY = 'linkToGitHub';
const TOGGLE_LINK_ACTION = 'toggle-link';

function isLinkEnabled(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, LINK_KEY)
        || (item.metadata?.[LINK_KEY] === undefined && isMetadataFlagEnabled(item, LEGACY_LINK_KEY));
}

function toggleLink(item: WidgetItem): WidgetItem {
    const nextEnabled = !isLinkEnabled(item);
    const {
        [LINK_KEY]: removedLink,
        [LEGACY_LINK_KEY]: removedLegacyLink,
        ...restMetadata
    } = item.metadata ?? {};

    void removedLink;
    void removedLegacyLink;

    const nextMetadata = nextEnabled
        ? { ...restMetadata, [LINK_KEY]: 'true' }
        : restMetadata;

    return {
        ...item,
        metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined
    };
}

export class GitBranchWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return '显示当前 Git 分支名'; }
    getDisplayName(): string { return 'Git 分支'; }
    getCategory(): string { return 'Git'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const isLink = isLinkEnabled(item);
        const modifiers: string[] = [];
        const noGitText = getHideNoGitModifierText(item);
        if (noGitText)
            modifiers.push('隐藏「无 Git」');
        if (isLink)
            modifiers.push('仓库链接');
        return {
            displayText: this.getDisplayName(),
            modifierText: makeModifierText(modifiers)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === TOGGLE_LINK_ACTION) {
            return toggleLink(item);
        }
        return handleToggleNoGitAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        void settings;
        const hideNoGit = isHideNoGitEnabled(item);
        const isLink = isLinkEnabled(item);

        if (context.isPreview) {
            const text = item.rawValue ? 'main' : '⎇ main';
            return isLink ? renderOsc8Link('https://github.com/owner/repo/tree/main', text) : text;
        }

        if (!isInsideGitWorkTree(context)) {
            return hideNoGit ? null : '⎇ 无 Git';
        }

        const branch = this.getGitBranch(context);
        if (!branch) {
            return hideNoGit ? null : '⎇ 无 Git';
        }

        const displayText = item.rawValue ? branch : `⎇ ${branch}`;

        if (isLink) {
            const origin = getRemoteInfo('origin', context);
            if (origin) {
                return renderOsc8Link(
                    buildBranchWebUrl(origin, encodeGitRefForUrlPath(branch)),
                    displayText
                );
            }
        }

        return displayText;
    }

    private getGitBranch(context: RenderContext): string | null {
        return runGit('symbolic-ref --short HEAD', context);
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            ...getHideNoGitKeybinds(),
            { key: 'l', label: '(l)仓库链接', action: TOGGLE_LINK_ACTION }
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
