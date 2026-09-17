import type {
    CustomKeybind,
    WidgetItem
} from '../../types/Widget';

import { makeModifierText } from './editor-display';
import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './metadata';

const LINK_TO_REPO_KEY = 'linkToRepo';
const TOGGLE_LINK_ACTION = 'toggle-link';

const LINK_TO_REPO_KEYBIND: CustomKeybind = {
    key: 'l',
    label: '(l)链接到仓库',
    action: TOGGLE_LINK_ACTION
};

export function isLinkToRepoEnabled(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, LINK_TO_REPO_KEY);
}

export function getRemoteWidgetModifierText(item: WidgetItem): string | undefined {
    return makeModifierText(isLinkToRepoEnabled(item) ? ['链接'] : []);
}

export function handleRemoteWidgetAction(action: string, item: WidgetItem): WidgetItem | null {
    if (action === TOGGLE_LINK_ACTION) {
        return toggleMetadataFlag(item, LINK_TO_REPO_KEY);
    }

    return null;
}

export function getRemoteWidgetKeybinds(): CustomKeybind[] {
    return [LINK_TO_REPO_KEYBIND];
}
