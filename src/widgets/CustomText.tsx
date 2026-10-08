import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';

import { MERGE_TARGET_HIDDEN_HIDEABLE_STATE } from './shared/hideable';
import { useTextCursor } from './shared/text-cursor';

export class CustomTextWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return '显示用户自定义文本'; }
    getDisplayName(): string { return '自定义文本'; }
    getCategory(): string { return '自定义'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const text = item.customText ?? '空';
        return { displayText: `${this.getDisplayName()} (${text})` };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        return item.customText ?? '';
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [{
            key: 'e',
            label: '(e)编辑文本',
            action: 'edit-text'
        }];
    }

    // The actual hiding happens in the renderer, which resolves the merge
    // target's rendered output (see applyMergeTargetHiding)
    getHideableStates(): HideableState[] {
        return [MERGE_TARGET_HIDDEN_HIDEABLE_STATE];
    }

    renderEditor(props: WidgetEditorProps): React.ReactElement {
        return <CustomTextEditor {...props} />;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

const CustomTextEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel }) => {
    const { getText, display, handleInput } = useTextCursor(widget.customText ?? '');

    useInput((input, key) => {
        if (key.return) {
            onComplete({ ...widget, customText: getText() });
        } else if (key.escape) {
            onCancel();
        } else {
            handleInput(input, key);
        }
    });

    return (
        <Box flexDirection='column'>
            <Text>{`输入自定义文本：${display}`}</Text>
            <Text dimColor>←→ 移动光标，Ctrl+←→ 跳到开头/末尾，Enter 保存，ESC 取消</Text>
        </Box>
    );
};
