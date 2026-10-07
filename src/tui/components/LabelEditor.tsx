import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import type { WidgetItem } from '../../types/Widget';
import {
    clearLabel,
    getLabel,
    setLabel
} from '../../widgets/shared/raw-or-labeled';
import { useTextCursor } from '../../widgets/shared/text-cursor';

export interface LabelEditorProps {
    widget: WidgetItem;
    defaultLabel: string;
    onComplete: (updatedWidget: WidgetItem) => void;
    onCancel: () => void;
}

export const LabelEditor: React.FC<LabelEditorProps> = ({ widget, defaultLabel, onComplete, onCancel }) => {
    const { getText, display, handleInput } = useTextCursor(getLabel(widget, defaultLabel));

    useInput((input, key) => {
        if (key.return) {
            onComplete(setLabel(widget, getText()));
        } else if (key.escape) {
            onCancel();
        } else if (key.tab) {
            onComplete(clearLabel(widget));
        } else {
            handleInput(input, key);
        }
    });

    // Quoted so trailing spaces, which usually separate the label from the
    // value, stay visible. One Text, because Ink measures a toned or joined
    // emoji as several columns and a sibling Text would overwrite its end.
    return (
        <Box flexDirection='column'>
            <Text bold>文字前缀</Text>
            <Text dimColor>←→ 移动光标，Ctrl+←→ 跳到开头/末尾，Tab 恢复默认，Enter 保存，ESC 取消</Text>
            <Box marginTop={1}>
                <Text>
                    {`"${display}"`}
                    <Text dimColor>{` (默认: ${JSON.stringify(defaultLabel)})`}</Text>
                </Text>
            </Box>
        </Box>
    );
};
