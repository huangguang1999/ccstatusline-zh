import type { RenderContext } from '../types/RenderContext';
import type {
    CustomKeybind,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getForkStatus,
    type RemoteInfo
} from '../utils/git-remote';

import { makeModifierText } from './shared/editor-display';
import { isLinkToRepoEnabled } from './shared/git-remote';
import { GitRemoteWidgetBase } from './shared/git-remote-widget-base';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';

const OWNER_ONLY_WHEN_FORK_KEY = 'ownerOnlyWhenFork';
const TOGGLE_OWNER_ONLY_ACTION = 'toggle-owner-only';

export class GitOriginOwnerRepoWidget extends GitRemoteWidgetBase {
    protected readonly remote = 'origin';
    protected readonly previewText = 'owner/repo';
    protected readonly previewUrl = 'https://github.com/owner/repo';

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '以 所有者/仓库 形式显示 origin 远程'; }
    getDisplayName(): string { return 'Git Origin 所有者/仓库'; }

    override getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers: string[] = [];

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

    override handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === TOGGLE_OWNER_ONLY_ACTION) {
            return toggleMetadataFlag(item, OWNER_ONLY_WHEN_FORK_KEY);
        }

        return super.handleEditorAction(action, item);
    }

    override getCustomKeybinds(): CustomKeybind[] {
        return [
            ...super.getCustomKeybinds(),
            { key: 'o', label: '(o)Fork 时仅显示 owner', action: TOGGLE_OWNER_ONLY_ACTION }
        ];
    }

    protected override getPreviewText(item: WidgetItem): string {
        return isMetadataFlagEnabled(item, OWNER_ONLY_WHEN_FORK_KEY) ? 'owner' : this.previewText;
    }

    protected formatRemote(remote: RemoteInfo, item: WidgetItem, context: RenderContext): string {
        const isFork = isMetadataFlagEnabled(item, OWNER_ONLY_WHEN_FORK_KEY) && getForkStatus(context).isFork;
        return isFork ? remote.owner : `${remote.owner}/${remote.repo}`;
    }
}
