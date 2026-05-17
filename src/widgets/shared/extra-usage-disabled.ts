import type {
    CustomKeybind,
    WidgetItem
} from '../../types/Widget';

import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './metadata';

const HIDE_DISABLED_KEY = 'hideIfDisabled';
const TOGGLE_HIDE_DISABLED_ACTION = 'toggle-hide-disabled';

const HIDE_DISABLED_KEYBIND: CustomKeybind = {
    key: 'h',
    label: '(h)禁用时隐藏',
    action: TOGGLE_HIDE_DISABLED_ACTION
};

export function isHideExtraUsageDisabledEnabled(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, HIDE_DISABLED_KEY);
}

export function handleToggleExtraUsageDisabledAction(action: string, item: WidgetItem): WidgetItem | null {
    if (action !== TOGGLE_HIDE_DISABLED_ACTION) {
        return null;
    }

    return toggleMetadataFlag(item, HIDE_DISABLED_KEY);
}

export function getHideExtraUsageDisabledKeybind(): CustomKeybind {
    return HIDE_DISABLED_KEYBIND;
}

export function appendHideDisabledModifier(modifierText: string | undefined, item: WidgetItem): string | undefined {
    if (!isHideExtraUsageDisabledEnabled(item)) {
        return modifierText;
    }

    if (!modifierText) {
        return '(禁用时隐藏)';
    }

    return `${modifierText.slice(0, -1)}, 禁用时隐藏)`;
}
