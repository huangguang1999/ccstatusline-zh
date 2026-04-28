import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import { getClaudeSettingsPath } from '../../utils/claude-settings';

import { List } from './List';

export interface InstallMenuProps {
    bunxAvailable: boolean;
    existingStatusLine: string | null;
    onSelectNpx: () => void;
    onSelectBunx: () => void;
    onCancel: () => void;
    initialSelection?: number;
}

export const InstallMenu: React.FC<InstallMenuProps> = ({
    bunxAvailable,
    existingStatusLine,
    onSelectNpx,
    onSelectBunx,
    onCancel,
    initialSelection = 0
}) => {
    useInput((_, key) => {
        if (key.escape) {
            onCancel();
        }
    });

    function onSelect(value: string) {
        switch (value) {
            case 'npx':
                onSelectNpx();
                break;
            case 'bunx':
                if (bunxAvailable) {
                    onSelectBunx();
                }
                break;
            case 'back':
                onCancel();
                break;
        }
    }

    const listItems = [
        {
            label: 'npx - Node 包执行器',
            value: 'npx'
        },
        {
            label: 'bunx - Bun 包执行器',
            sublabel: bunxAvailable ? undefined : '（未安装）',
            value: 'bunx',
            disabled: !bunxAvailable
        }
    ];

    return (
        <Box flexDirection='column'>
            <Text bold>安装 ccstatusline-zh 到 Claude Code</Text>

            {existingStatusLine && (
                <Box marginBottom={1}>
                    <Text color='yellow'>
                        ⚠ 当前状态栏: "
                        {existingStatusLine}
                        "
                    </Text>
                </Box>
            )}

            <Box>
                <Text dimColor>选择要使用的包管理器：</Text>
            </Box>

            <List
                color='blue'
                marginTop={1}
                items={listItems}
                onSelect={(line) => {
                    if (line === 'back') {
                        onCancel();
                        return;
                    }

                    onSelect(line);
                }}
                initialSelection={initialSelection}
                showBackButton={true}
            />

            <Box marginTop={2}>
                <Text dimColor>
                    所选命令将写入
                    {' '}
                    {getClaudeSettingsPath()}
                </Text>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>按 Enter 选择，ESC 取消</Text>
            </Box>
        </Box>
    );
};
