import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { Settings } from '../../types/Settings';
import {
    COLOR_MAP,
    getChalkColor,
    getColorDisplayName
} from '../../utils/colors';
import { shouldInsertInput } from '../../utils/input-guards';

import { ConfirmDialog } from './ConfirmDialog';

export interface GlobalOverridesMenuProps {
    settings: Settings;
    onUpdate: (settings: Settings) => void;
    onBack: () => void;
}

export const GlobalOverridesMenu: React.FC<GlobalOverridesMenuProps> = ({ settings, onUpdate, onBack }) => {
    const [editingPadding, setEditingPadding] = useState(false);
    const [editingSeparator, setEditingSeparator] = useState(false);
    const [confirmingSeparator, setConfirmingSeparator] = useState(false);
    const [paddingInput, setPaddingInput] = useState(settings.defaultPadding ?? '');
    const [separatorInput, setSeparatorInput] = useState(settings.defaultSeparator ?? '');
    const [inheritColors, setInheritColors] = useState(settings.inheritSeparatorColors);
    const [globalBold, setGlobalBold] = useState(settings.globalBold);
    const [minimalistMode, setMinimalistMode] = useState(settings.minimalistMode);
    const isPowerlineEnabled = settings.powerline.enabled;

    // Check if there are any manual separators in the current configuration
    const hasManualSeparators = settings.lines.some(line => line.some(item => item.type === 'separator')
    );

    // Get colors from COLOR_MAP
    const bgColors = ['none', ...COLOR_MAP.filter(c => c.isBackground).map(c => c.name)];
    const fgColors = ['none', ...COLOR_MAP.filter(c => !c.isBackground).map(c => c.name)];

    const currentBgIndex = bgColors.indexOf(settings.overrideBackgroundColor ?? 'none');
    const currentFgIndex = fgColors.indexOf(settings.overrideForegroundColor ?? 'none');

    useInput((input, key) => {
        if (editingPadding) {
            if (key.return) {
                const updatedSettings = {
                    ...settings,
                    defaultPadding: paddingInput
                };
                onUpdate(updatedSettings);
                setEditingPadding(false);
            } else if (key.escape) {
                setPaddingInput(settings.defaultPadding ?? '');
                setEditingPadding(false);
            } else if (key.backspace) {
                setPaddingInput(paddingInput.slice(0, -1));
            } else if (key.delete) {
                // For simple text inputs without cursor, forward delete does nothing
            } else if (shouldInsertInput(input, key)) {
                setPaddingInput(paddingInput + input);
            }
        } else if (editingSeparator) {
            if (key.return) {
                // Only show confirmation if setting a non-empty separator AND there are manual separators
                if (separatorInput && hasManualSeparators) {
                    setEditingSeparator(false);
                    setConfirmingSeparator(true);
                } else {
                    // Apply directly without confirmation
                    const updatedSettings = {
                        ...settings,
                        defaultSeparator: separatorInput || undefined,
                        // Only remove manual separators if we're setting a non-empty default
                        lines: separatorInput
                            ? settings.lines.map(line => line.filter(item => item.type !== 'separator'))
                            : settings.lines
                    };
                    onUpdate(updatedSettings);
                    setEditingSeparator(false);
                }
            } else if (key.escape) {
                setSeparatorInput(settings.defaultSeparator ?? '');
                setEditingSeparator(false);
            } else if (key.backspace) {
                setSeparatorInput(separatorInput.slice(0, -1));
            } else if (key.delete) {
                // For simple text inputs without cursor, forward delete does nothing
            } else if (shouldInsertInput(input, key)) {
                setSeparatorInput(separatorInput + input);
            }
        } else if (confirmingSeparator) {
            // Skip input handling when confirmation is active - let ConfirmDialog handle it
            return;
        } else {
            if (key.escape) {
                onBack();
            } else if (input === 'p' || input === 'P') {
                setEditingPadding(true);
            } else if ((input === 's' || input === 'S') && !isPowerlineEnabled && !key.ctrl) {
                setEditingSeparator(true);
            } else if ((input === 'i' || input === 'I') && !isPowerlineEnabled) {
                const newInheritColors = !inheritColors;
                setInheritColors(newInheritColors);
                const updatedSettings = {
                    ...settings,
                    inheritSeparatorColors: newInheritColors
                };
                onUpdate(updatedSettings);
            } else if ((input === 'b' || input === 'B') && !isPowerlineEnabled) {
                // Cycle through background colors
                const nextIndex = (currentBgIndex + 1) % bgColors.length;
                const nextBgColor = bgColors[nextIndex];
                const updatedSettings = {
                    ...settings,
                    overrideBackgroundColor: nextBgColor === 'none' ? undefined : nextBgColor
                };
                onUpdate(updatedSettings);
            } else if ((input === 'c' || input === 'C') && !isPowerlineEnabled) {
                // Clear override background color
                const updatedSettings = {
                    ...settings,
                    overrideBackgroundColor: undefined
                };
                onUpdate(updatedSettings);
            } else if (input === 'o' || input === 'O') {
                // Toggle global bold
                const newGlobalBold = !globalBold;
                setGlobalBold(newGlobalBold);
                const updatedSettings = {
                    ...settings,
                    globalBold: newGlobalBold
                };
                onUpdate(updatedSettings);
            } else if (input === 'm' || input === 'M') {
                // Toggle minimalist mode
                const newMinimalistMode = !minimalistMode;
                setMinimalistMode(newMinimalistMode);
                const updatedSettings = {
                    ...settings,
                    minimalistMode: newMinimalistMode
                };
                onUpdate(updatedSettings);
            } else if (input === 'f' || input === 'F') {
                // Cycle through foreground colors
                const nextIndex = (currentFgIndex + 1) % fgColors.length;
                const nextFgColor = fgColors[nextIndex];
                const updatedSettings = {
                    ...settings,
                    overrideForegroundColor: nextFgColor === 'none' ? undefined : nextFgColor
                };
                onUpdate(updatedSettings);
            } else if (input === 'g' || input === 'G') {
                // Clear override foreground color
                const updatedSettings = {
                    ...settings,
                    overrideForegroundColor: undefined
                };
                onUpdate(updatedSettings);
            }
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>全局覆盖</Text>
            <Text dimColor>配置组件之间的自动内边距和分隔符</Text>
            {isPowerlineEnabled && (
                <Box marginTop={1}>
                    <Text color='yellow'>⚠ Powerline 模式激活时部分选项已禁用</Text>
                </Box>
            )}
            <Box marginTop={1} />

            {editingPadding ? (
                <Box flexDirection='column'>
                    <Box>
                        <Text>输入默认内边距（应用于每个组件的左右两侧）：</Text>
                        <Text color='cyan'>{paddingInput ? `"${paddingInput}"` : '（空）'}</Text>
                    </Box>
                    <Text dimColor>按 Enter 保存，ESC 取消</Text>
                </Box>
            ) : editingSeparator ? (
                <Box flexDirection='column'>
                    <Box>
                        <Text>输入默认分隔符（放置在组件之间）：</Text>
                        <Text color='cyan'>{separatorInput ? `"${separatorInput}"` : '（空 - 不添加分隔符）'}</Text>
                    </Box>
                    <Text dimColor>按 Enter 保存，ESC 取消</Text>
                </Box>
            ) : confirmingSeparator ? (
                <Box flexDirection='column'>
                    <Box marginBottom={1}>
                        <Text color='yellow'>⚠ 警告：设置默认分隔符将移除状态栏中所有现有的手动分隔符。</Text>
                    </Box>
                    <Box>
                        <Text>新默认分隔符：</Text>
                        <Text color='cyan'>{separatorInput ? `"${separatorInput}"` : '（空）'}</Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text>是否要继续？</Text>
                    </Box>
                    <Box marginTop={1}>
                        <ConfirmDialog
                            inline={true}
                            onConfirm={() => {
                                // Remove all manual separators from lines
                                const updatedSettings = {
                                    ...settings,
                                    defaultSeparator: separatorInput,
                                    lines: settings.lines.map(line => line.filter(item => item.type !== 'separator')
                                    )
                                };
                                onUpdate(updatedSettings);
                                setConfirmingSeparator(false);
                            }}
                            onCancel={() => {
                                // Cancel without applying changes
                                setSeparatorInput(settings.defaultSeparator ?? '');
                                setConfirmingSeparator(false);
                            }}
                        />
                    </Box>
                </Box>
            ) : (
                <>
                    <Box>
                        <Text>      全局加粗: </Text>
                        <Text color={globalBold ? 'green' : 'red'}>{globalBold ? '✓ 已启用' : '✗ 已禁用'}</Text>
                        <Text dimColor> - 按 (o) 切换</Text>
                    </Box>

                    <Box>
                        <Text>极简模式: </Text>
                        <Text color={minimalistMode ? 'green' : 'red'}>{minimalistMode ? '✓ 已启用' : '✗ 已禁用'}</Text>
                        <Text dimColor> - 按 (m) 切换</Text>
                    </Box>

                    <Box>
                        <Text>  默认内边距: </Text>
                        <Text color='cyan'>{settings.defaultPadding ? `"${settings.defaultPadding}"` : '（无）'}</Text>
                        <Text dimColor> - 按 (p) 编辑</Text>
                    </Box>

                    <Box>
                        <Text>覆盖前景色: </Text>
                        {(() => {
                            const fgColor = settings.overrideForegroundColor ?? 'none';
                            if (fgColor === 'none') {
                                return <Text color='gray'>(none)</Text>;
                            } else {
                                const displayName = getColorDisplayName(fgColor);
                                const fgChalk = getChalkColor(fgColor, 'ansi16', false);
                                const display = fgChalk ? fgChalk(displayName) : displayName;
                                return <Text>{display}</Text>;
                            }
                        })()}
                        <Text dimColor> - (f) 切换，(g) 清除</Text>
                    </Box>

                    <Box>
                        <Text>覆盖背景色: </Text>
                        {isPowerlineEnabled ? (
                            <Text dimColor>[已禁用 - Powerline 激活中]</Text>
                        ) : (
                            <>
                                {(() => {
                                    const bgColor = settings.overrideBackgroundColor ?? 'none';
                                    if (bgColor === 'none') {
                                        return <Text color='gray'>(none)</Text>;
                                    } else {
                                        const displayName = getColorDisplayName(bgColor);
                                        const bgChalk = getChalkColor(bgColor, 'ansi16', true);
                                        const display = bgChalk ? bgChalk(` ${displayName} `) : displayName;
                                        return <Text>{display}</Text>;
                                    }
                                })()}
                                <Text dimColor> - (b) 切换，(c) 清除</Text>
                            </>
                        )}
                    </Box>

                    <Box>
                        <Text>   继承颜色: </Text>
                        {isPowerlineEnabled ? (
                            <Text dimColor>[已禁用 - Powerline 激活中]</Text>
                        ) : (
                            <>
                                <Text color={inheritColors ? 'green' : 'red'}>{inheritColors ? '✓ 已启用' : '✗ 已禁用'}</Text>
                                <Text dimColor> - 按 (i) 切换</Text>
                            </>
                        )}
                    </Box>

                    <Box>
                        <Text>默认分隔符: </Text>
                        {isPowerlineEnabled ? (
                            <Text dimColor>[已禁用 - Powerline 激活中]</Text>
                        ) : (
                            <>
                                <Text color='cyan'>{settings.defaultSeparator ? `"${settings.defaultSeparator}"` : '（无）'}</Text>
                                <Text dimColor> - 按 (s) 编辑</Text>
                            </>
                        )}
                    </Box>

                    <Box marginTop={2}>
                        <Text dimColor>按 ESC 返回</Text>
                    </Box>

                    <Box marginTop={1} flexDirection='column'>
                        <Text dimColor wrap='wrap'>
                            注意：这些设置在渲染时应用，不会向组件列表中添加组件。
                        </Text>
                        <Text dimColor wrap='wrap'>
                            • 继承颜色：分隔符将使用前一个组件的颜色
                        </Text>
                        <Text dimColor wrap='wrap'>
                            • 全局加粗：无论单个设置如何，所有文本都会加粗
                        </Text>
                        <Text dimColor wrap='wrap'>
                            • 极简模式：去除组件的装饰性前缀和标签
                        </Text>
                        <Text dimColor wrap='wrap'>
                            • 覆盖颜色：所有组件将使用这些颜色而非其配置的颜色
                        </Text>
                    </Box>
                </>
            )}
        </Box>
    );
};
