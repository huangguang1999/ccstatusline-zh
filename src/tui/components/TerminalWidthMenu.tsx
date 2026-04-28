import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { FlexMode } from '../../types/FlexMode';
import type { Settings } from '../../types/Settings';
import { shouldInsertInput } from '../../utils/input-guards';

import {
    List,
    type ListEntry
} from './List';

export const TERMINAL_WIDTH_OPTIONS: FlexMode[] = ['full', 'full-minus-40', 'full-until-compact'];

export function getTerminalWidthSelectionIndex(selectedOption: FlexMode): number {
    const selectedIndex = TERMINAL_WIDTH_OPTIONS.indexOf(selectedOption);

    return selectedIndex >= 0 ? selectedIndex : 0;
}

export function validateCompactThresholdInput(value: string): string | null {
    const parsedValue = parseInt(value, 10);

    if (isNaN(parsedValue)) {
        return 'Please enter a valid number';
    }

    if (parsedValue < 1 || parsedValue > 99) {
        return `Value must be between 1 and 99 (you entered ${parsedValue})`;
    }

    return null;
}

export function buildTerminalWidthItems(
    selectedOption: FlexMode,
    compactThreshold: number
): ListEntry<FlexMode>[] {
    return [
        {
            value: 'full',
            label: '始终全宽',
            sublabel: selectedOption === 'full' ? '（当前）' : undefined,
            description: '使用完整终端宽度减去 4 个字符的终端内边距。如果出现自动压缩消息，可能导致行换行。\n\n注意：如果启用了 /ide 集成，不建议使用此模式。'
        },
        {
            value: 'full-minus-40',
            label: '全宽减 40',
            sublabel: selectedOption === 'full-minus-40' ? '（当前）' : '（默认）',
            description: '在状态栏右侧留出空间以容纳自动压缩消息。这可以防止换行但可能留下未使用的空间。此限制存在是因为我们无法检测消息何时出现。'
        },
        {
            value: 'full-until-compact',
            label: '上下文压缩前全宽',
            sublabel: selectedOption === 'full-until-compact'
                ? `（阈值 ${compactThreshold}%，当前）`
                : `（阈值 ${compactThreshold}%）`,
            description: `根据上下文使用情况动态调整宽度。当上下文达到 ${compactThreshold}% 时，切换为留出自动压缩消息空间。\n\n注意：如果启用了 /ide 集成，不建议使用此模式。`
        }
    ];
}

export interface TerminalWidthMenuProps {
    settings: Settings;
    onUpdate: (settings: Settings) => void;
    onBack: () => void;
}

export const TerminalWidthMenu: React.FC<TerminalWidthMenuProps> = ({
    settings,
    onUpdate,
    onBack
}) => {
    const [selectedOption, setSelectedOption] = useState<FlexMode>(settings.flexMode);
    const [compactThreshold, setCompactThreshold] = useState(settings.compactThreshold);
    const [editingThreshold, setEditingThreshold] = useState(false);
    const [thresholdInput, setThresholdInput] = useState(String(settings.compactThreshold));
    const [validationError, setValidationError] = useState<string | null>(null);

    useInput((input, key) => {
        if (editingThreshold) {
            if (key.return) {
                const error = validateCompactThresholdInput(thresholdInput);

                if (error) {
                    setValidationError(error);
                } else {
                    const value = parseInt(thresholdInput, 10);
                    setCompactThreshold(value);

                    const updatedSettings = {
                        ...settings,
                        flexMode: selectedOption,
                        compactThreshold: value
                    };
                    onUpdate(updatedSettings);
                    setEditingThreshold(false);
                    setValidationError(null);
                }
            } else if (key.escape) {
                setThresholdInput(String(compactThreshold));
                setEditingThreshold(false);
                setValidationError(null);
            } else if (key.backspace) {
                setThresholdInput(thresholdInput.slice(0, -1));
                setValidationError(null);
            } else if (key.delete) {
                // For simple number inputs, forward delete does nothing since there's no cursor position
            } else if (shouldInsertInput(input, key) && /\d/.test(input)) {
                const newValue = thresholdInput + input;
                if (newValue.length <= 2) {
                    setThresholdInput(newValue);
                    setValidationError(null);
                }
            }
            return;
        }

        if (key.escape) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>终端宽度</Text>
            <Text color='white'>这些设置影响长行的截断位置，以及使用弹性分隔符时的右对齐位置</Text>
            <Text dimColor wrap='wrap'>Claude Code 目前未提供状态栏可用宽度变量，IDE 集成、自动压缩通知等功能都可能导致状态栏换行（如果不进行截断）</Text>

            {editingThreshold ? (
                <Box marginTop={1} flexDirection='column'>
                    <Text>
                        输入压缩阈值（1-99）：
                        {' '}
                        {thresholdInput}
                        %
                    </Text>
                    {validationError ? (
                        <Text color='red'>{validationError}</Text>
                    ) : (
                        <Text dimColor>按 Enter 确认，ESC 取消</Text>
                    )}
                </Box>
            ) : (
                <List
                    marginTop={1}
                    items={buildTerminalWidthItems(selectedOption, compactThreshold)}
                    initialSelection={getTerminalWidthSelectionIndex(selectedOption)}
                    onSelect={(value) => {
                        if (value === 'back') {
                            onBack();
                            return;
                        }

                        setSelectedOption(value);

                        const updatedSettings = {
                            ...settings,
                            flexMode: value,
                            compactThreshold
                        };
                        onUpdate(updatedSettings);

                        if (value === 'full-until-compact') {
                            setEditingThreshold(true);
                        }
                    }}
                    showBackButton={true}
                />
            )}
        </Box>
    );
};
