import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import { shouldInsertInput } from '../../utils/input-guards';

interface ImportConfigDialogProps {
    onFileChosen: (filePath: string) => void;
    onCancel: () => void;
}

export function ImportConfigDialog({ onFileChosen, onCancel }: ImportConfigDialogProps): React.JSX.Element {
    const [inputValue, setInputValue] = useState('');

    useInput((input, key) => {
        if (key.return) {
            onFileChosen(inputValue);
        } else if (key.escape) {
            onCancel();
        } else if (key.backspace) {
            setInputValue(inputValue.slice(0, -1));
        } else if (shouldInsertInput(input, key)) {
            setInputValue(inputValue + input);
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>导入配置</Text>
            <Text dimColor>请输入要导入的配置文件路径：</Text>
            <Box marginTop={1}>
                <Text>路径： </Text>
                <Text>{inputValue}</Text>
                <Text inverse> </Text>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>按 Enter 确认，按 Esc 取消</Text>
            </Box>
        </Box>
    );
}
