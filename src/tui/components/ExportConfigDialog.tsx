import {
    Box,
    Text,
    useInput
} from 'ink';
import * as os from 'os';
import * as path from 'path';
import React, { useState } from 'react';

import { shouldInsertInput } from '../../utils/input-guards';

interface ExportConfigDialogProps {
    onExport: (filePath: string) => void;
    onCancel: () => void;
}

const DEFAULT_EXPORT_PATH = path.join(os.homedir(), 'ccstatusline-zh-config.json');

export function ExportConfigDialog({ onExport, onCancel }: ExportConfigDialogProps): React.JSX.Element {
    const [inputValue, setInputValue] = useState(DEFAULT_EXPORT_PATH);

    useInput((input, key) => {
        if (key.return) {
            onExport(inputValue);
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
            <Text bold>导出配置</Text>
            <Text dimColor>请输入配置文件的导出路径：</Text>
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
