import chalk from 'chalk';
import {
    Box,
    Text,
    useInput
} from 'ink';
import SelectInput from 'ink-select-input';
import React, { useState } from 'react';

import { getColorLevelString } from '../../types/ColorLevel';
import type { Settings } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import {
    applyColors,
    getAvailableBackgroundColorsForUI,
    getAvailableColorsForUI
} from '../../utils/colors';
import { shouldInsertInput } from '../../utils/input-guards';
import { getWidget } from '../../utils/widgets';

import { ConfirmDialog } from './ConfirmDialog';
import {
    clearAllWidgetStyling,
    cycleWidgetColor,
    resetWidgetStyling,
    setWidgetColor,
    toggleWidgetBold
} from './color-menu/mutations';

export interface ColorMenuProps {
    widgets: WidgetItem[];
    lineIndex?: number;
    settings: Settings;
    onUpdate: (widgets: WidgetItem[]) => void;
    onBack: () => void;
}

export const ColorMenu: React.FC<ColorMenuProps> = ({ widgets, lineIndex, settings, onUpdate, onBack }) => {
    const [showSeparators, setShowSeparators] = useState(false);
    const [hexInputMode, setHexInputMode] = useState(false);
    const [hexInput, setHexInput] = useState('');
    const [ansi256InputMode, setAnsi256InputMode] = useState(false);
    const [ansi256Input, setAnsi256Input] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const powerlineEnabled = settings.powerline.enabled;

    const colorableWidgets = widgets.filter((widget) => {
        // Include separators only if showSeparators is true
        if (widget.type === 'separator') {
            return showSeparators;
        }
        // Use the widget's supportsColors method
        const widgetInstance = getWidget(widget.type);
        // Include unknown widgets (they might support colors, we just don't know)
        return widgetInstance ? widgetInstance.supportsColors(widget) : true;
    });
    const [highlightedItemId, setHighlightedItemId] = useState(colorableWidgets[0]?.id ?? null);
    const [editingBackground, setEditingBackground] = useState(false);

    // Handle keyboard input
    const hasNoItems = colorableWidgets.length === 0;
    useInput((input, key) => {
        // If no items, any key goes back
        if (hasNoItems) {
            onBack();
            return;
        }

        // Skip input handling when confirmation is active - let ConfirmDialog handle it
        if (showClearConfirm) {
            return;
        }

        // Handle hex input mode
        if (hexInputMode) {
            // Disable arrow keys in input mode
            if (key.upArrow || key.downArrow) {
                return;
            }
            if (key.escape) {
                setHexInputMode(false);
                setHexInput('');
            } else if (key.return) {
                // Validate and apply the hex color
                if (hexInput.length === 6) {
                    const hexColor = `hex:${hexInput}`;
                    const selectedWidget = colorableWidgets.find(widget => widget.id === highlightedItemId);
                    if (selectedWidget) {
                        const newItems = setWidgetColor(widgets, selectedWidget.id, hexColor, editingBackground);
                        onUpdate(newItems);
                    }
                    setHexInputMode(false);
                    setHexInput('');
                }
            } else if (key.backspace || key.delete) {
                setHexInput(hexInput.slice(0, -1));
            } else if (shouldInsertInput(input, key) && hexInput.length < 6) {
                // Only accept hex characters (0-9, A-F, a-f)
                const upperInput = input.toUpperCase();
                if (/^[0-9A-F]$/.test(upperInput)) {
                    setHexInput(hexInput + upperInput);
                }
            }
            return;
        }

        // Handle ansi256 input mode
        if (ansi256InputMode) {
            // Disable arrow keys in input mode
            if (key.upArrow || key.downArrow) {
                return;
            }
            if (key.escape) {
                setAnsi256InputMode(false);
                setAnsi256Input('');
            } else if (key.return) {
                // Validate and apply the ansi256 color
                const code = parseInt(ansi256Input, 10);
                if (!isNaN(code) && code >= 0 && code <= 255) {
                    const ansiColor = `ansi256:${code}`;

                    const selectedWidget = colorableWidgets.find(widget => widget.id === highlightedItemId);

                    if (selectedWidget) {
                        const newItems = setWidgetColor(widgets, selectedWidget.id, ansiColor, editingBackground);

                        onUpdate(newItems);
                        setAnsi256InputMode(false);
                        setAnsi256Input('');
                    }
                }
            } else if (key.backspace || key.delete) {
                setAnsi256Input(ansi256Input.slice(0, -1));
            } else if (shouldInsertInput(input, key) && ansi256Input.length < 3) {
                // Only accept numeric characters (0-9)
                if (/^[0-9]$/.test(input)) {
                    const newInput = ansi256Input + input;
                    const code = parseInt(newInput, 10);
                    // Only allow if it won't exceed 255
                    if (code <= 255) {
                        setAnsi256Input(newInput);
                    }
                }
            }
            return;
        }

        // Ignore number keys to prevent SelectInput numerical navigation
        if (input && /^[0-9]$/.test(input)) {
            return;
        }

        // Normal keyboard handling when there are items
        if (key.escape) {
            if (editingBackground) {
                setEditingBackground(false);
            } else {
                onBack();
            }
        } else if (input === 'h' || input === 'H') {
            // Enter hex input mode (only in truecolor mode)
            if (highlightedItemId && highlightedItemId !== 'back' && settings.colorLevel === 3) {
                setHexInputMode(true);
                setHexInput('');
            }
        } else if (input === 'a' || input === 'A') {
            // Enter ansi256 input mode (only in 256 color mode)
            if (highlightedItemId && highlightedItemId !== 'back' && settings.colorLevel === 2) {
                setAnsi256InputMode(true);
                setAnsi256Input('');
            }
        } else if ((input === 's' || input === 'S') && !key.ctrl) {
            // Toggle show separators (only if not in powerline mode and no default separator)
            if (!settings.powerline.enabled && !settings.defaultSeparator) {
                setShowSeparators(!showSeparators);
                // The highlighted item ID will be maintained, and we'll recalculate
                // the initial index when rendering the SelectInput
            }
        } else if (input === 'f' || input === 'F') {
            if (colorableWidgets.length > 0) {
                setEditingBackground(!editingBackground);
            }
        } else if (input === 'b' || input === 'B') {
            if (highlightedItemId && highlightedItemId !== 'back') {
                // Toggle bold for the highlighted item
                const selectedWidget = colorableWidgets.find(widget => widget.id === highlightedItemId);
                if (selectedWidget) {
                    const newItems = toggleWidgetBold(widgets, selectedWidget.id);
                    onUpdate(newItems);
                }
            }
        } else if (input === 'r' || input === 'R') {
            if (highlightedItemId && highlightedItemId !== 'back') {
                // Reset all styling (color, background, and bold) for the highlighted item
                const selectedWidget = colorableWidgets.find(widget => widget.id === highlightedItemId);
                if (selectedWidget) {
                    const newItems = resetWidgetStyling(widgets, selectedWidget.id);
                    onUpdate(newItems);
                }
            }
        } else if (input === 'c' || input === 'C') {
            // Show clear all confirmation
            setShowClearConfirm(true);
        } else if (key.leftArrow || key.rightArrow) {
            // Cycle through colors with arrow keys
            if (highlightedItemId && highlightedItemId !== 'back') {
                const selectedWidget = colorableWidgets.find(widget => widget.id === highlightedItemId);
                if (selectedWidget) {
                    const newItems = cycleWidgetColor({
                        widgets,
                        widgetId: selectedWidget.id,
                        direction: key.rightArrow ? 'right' : 'left',
                        editingBackground,
                        colors,
                        backgroundColors: bgColors
                    });
                    onUpdate(newItems);
                }
            }
        }
    });

    if (hasNoItems) {
        return (
            <Box flexDirection='column'>
                <Text bold>
                    配置颜色
                    {lineIndex !== undefined ? ` - 第 ${lineIndex + 1} 行` : ''}
                </Text>
                <Box marginTop={1}><Text dimColor>状态栏中没有可着色的组件。</Text></Box>
                <Text dimColor>请先添加一个组件再继续。</Text>
                <Box marginTop={1}><Text>按任意键返回...</Text></Box>
            </Box>
        );
    }

    const getItemLabel = (widget: WidgetItem) => {
        if (widget.type === 'separator') {
            const char = widget.character ?? '|';
            return `分隔符: ${char === ' ' ? '空格' : char}`;
        }
        if (widget.type === 'flex-separator') {
            return '弹性分隔符';
        }

        const widgetImpl = getWidget(widget.type);
        return widgetImpl ? widgetImpl.getDisplayName() : `未知: ${widget.type}`;
    };

    // Color list for cycling
    // Get available colors from colors.ts
    const colorOptions = getAvailableColorsForUI();
    const colors = colorOptions.map(c => c.value || '');

    // For background, get background colors
    const bgColorOptions = getAvailableBackgroundColorsForUI();
    const bgColors = bgColorOptions.map(c => c.value || '');

    // Create menu items with colored labels
    const menuItems = colorableWidgets.map((widget, index) => {
        const label = `${index + 1}: ${getItemLabel(widget)}`;
        // Apply both foreground and background colors
        const level = getColorLevelString(settings.colorLevel);
        let defaultColor = 'white';
        if (widget.type !== 'separator' && widget.type !== 'flex-separator') {
            const widgetImpl = getWidget(widget.type);
            if (widgetImpl) {
                defaultColor = widgetImpl.getDefaultColor();
            }
        }
        const styledLabel = applyColors(label, widget.color ?? defaultColor, widget.backgroundColor, widget.bold, level);
        return {
            label: styledLabel,
            value: widget.id
        };
    });
    menuItems.push({ label: '← Back', value: 'back' });

    const handleSelect = (selected: { value: string }) => {
        if (selected.value === 'back') {
            onBack();
        }
        // Enter no longer cycles colors - use left/right arrow keys instead
    };

    const handleHighlight = (item: { value: string }) => {
        setHighlightedItemId(item.value);
    };

    // Get current color for highlighted item
    const selectedWidget = highlightedItemId && highlightedItemId !== 'back'
        ? colorableWidgets.find(widget => widget.id === highlightedItemId)
        : null;
    const currentColor = editingBackground
        ? (selectedWidget?.backgroundColor ?? '')  // Empty string for 'none'
        : (selectedWidget ? (selectedWidget.color ?? (() => {
            if (selectedWidget.type !== 'separator' && selectedWidget.type !== 'flex-separator') {
                const widgetImpl = getWidget(selectedWidget.type);
                return widgetImpl ? widgetImpl.getDefaultColor() : 'white';
            }
            return 'white';
        })()) : 'white');

    const colorList = editingBackground ? bgColors : colors;
    const colorIndex = colorList.indexOf(currentColor);
    const colorNumber = colorIndex === -1 ? 'custom' : colorIndex + 1;

    let colorDisplay;
    if (editingBackground) {
        if (!currentColor || currentColor === '') {
            colorDisplay = chalk.gray('(no background)');
        } else {
            // Determine display name based on format
            let displayName;
            if (currentColor.startsWith('ansi256:')) {
                displayName = `ANSI ${currentColor.substring(8)}`;
            } else if (currentColor.startsWith('hex:')) {
                displayName = `#${currentColor.substring(4)}`;
            } else {
                const colorOption = bgColorOptions.find(c => c.value === currentColor);
                displayName = colorOption ? colorOption.name : currentColor;
            }

            // Apply the color using our applyColors function with the current colorLevel
            const level = getColorLevelString(settings.colorLevel);
            colorDisplay = applyColors(` ${displayName} `, undefined, currentColor, false, level);
        }
    } else {
        if (!currentColor || currentColor === '') {
            colorDisplay = chalk.gray('(default)');
        } else {
            // Determine display name based on format
            let displayName;
            if (currentColor.startsWith('ansi256:')) {
                displayName = `ANSI ${currentColor.substring(8)}`;
            } else if (currentColor.startsWith('hex:')) {
                displayName = `#${currentColor.substring(4)}`;
            } else {
                const colorOption = colorOptions.find(c => c.value === currentColor);
                displayName = colorOption ? colorOption.name : currentColor;
            }

            // Apply the color using our applyColors function with the current colorLevel
            const level = getColorLevelString(settings.colorLevel);
            colorDisplay = applyColors(displayName, currentColor, undefined, false, level);
        }
    }

    // Show confirmation dialog if clearing all colors
    if (showClearConfirm) {
        return (
            <Box flexDirection='column'>
                <Text bold color='yellow'>⚠ 确认清除所有颜色</Text>
                <Box marginTop={1} flexDirection='column'>
                    <Text>这将把所有组件的颜色重置为默认值。</Text>
                    <Text color='red'>此操作不可撤销！</Text>
                </Box>
                <Box marginTop={2}>
                    <Text>是否继续？</Text>
                </Box>
                <Box marginTop={1}>
                    <ConfirmDialog
                        inline={true}
                        onConfirm={() => {
                            const newItems = clearAllWidgetStyling(widgets);
                            onUpdate(newItems);
                            setShowClearConfirm(false);
                        }}
                        onCancel={() => {
                            setShowClearConfirm(false);
                        }}
                    />
                </Box>
            </Box>
        );
    }

    // Check for global overrides
    // Note: When powerline is enabled, background override doesn't affect the display
    // since powerline uses item-specific backgrounds for segments
    const hasGlobalFgOverride = !!settings.overrideForegroundColor;
    const hasGlobalBgOverride = !!settings.overrideBackgroundColor && !powerlineEnabled;
    const globalOverrideMessage = hasGlobalFgOverride && hasGlobalBgOverride
        ? '⚠ Global override for FG and BG active'
        : hasGlobalFgOverride
            ? '⚠ Global override for FG active'
            : hasGlobalBgOverride
                ? '⚠ Global override for BG active'
                : null;

    return (
        <Box flexDirection='column'>
            <Box>
                <Text bold>
                    配置颜色
                    {lineIndex !== undefined ? ` - 第 ${lineIndex + 1} 行` : ''}
                    {editingBackground && chalk.yellow(' [背景色模式]')}
                </Text>
                {globalOverrideMessage && (
                    <Text color='yellow' dimColor>
                        {'.  '}
                        {globalOverrideMessage}
                    </Text>
                )}
            </Box>
            {hexInputMode ? (
                <Box flexDirection='column'>
                    <Text>输入 6 位十六进制颜色代码（不含 #）：</Text>
                    <Text>
                        #
                        {hexInput}
                        <Text dimColor>{hexInput.length < 6 ? '_'.repeat(6 - hexInput.length) : ''}</Text>
                    </Text>
                    <Text> </Text>
                    <Text dimColor>按 Enter 确认，ESC 取消</Text>
                </Box>
            ) : ansi256InputMode ? (
                <Box flexDirection='column'>
                    <Text>输入 ANSI 256 颜色代码（0-255）：</Text>
                    <Text>
                        {ansi256Input}
                        <Text dimColor>{ansi256Input.length === 0 ? '___' : ansi256Input.length === 1 ? '__' : ansi256Input.length === 2 ? '_' : ''}</Text>
                    </Text>
                    <Text> </Text>
                    <Text dimColor>按 Enter 确认，ESC 取消</Text>
                </Box>
            ) : (
                <>
                    <Text dimColor>
                        ↑↓ 选择，←→ 切换
                        {' '}
                        {editingBackground ? '背景色' : '前景色'}
                        ，(f) 前景/背景切换，(b)加粗，
                        {settings.colorLevel === 3 ? ' (h)十六进制，' : settings.colorLevel === 2 ? ' (a)nsi256，' : ''}
                        {' '}
                        (r)重置，(c)清除全部，ESC 返回
                    </Text>
                    {!settings.powerline.enabled && !settings.defaultSeparator && (
                        <Text dimColor>
                            (s)显示分隔符：
                            {showSeparators ? chalk.green('ON') : chalk.gray('OFF')}
                        </Text>
                    )}
                    {selectedWidget ? (
                        <Box marginTop={1}>
                            <Text>
                                当前
                                {' '}
                                {editingBackground ? '背景色' : '前景色'}
                                {' '}
                                (
                                {colorNumber === 'custom' ? '自定义' : `${colorNumber}/${colorList.length}`}
                                ):
                                {' '}
                                {colorDisplay}
                                {selectedWidget.bold && chalk.bold(' [加粗]')}
                            </Text>
                        </Box>
                    ) : (
                        <Box marginTop={1}>
                            <Text> </Text>
                        </Box>
                    )}
                </>
            )}
            <Box marginTop={1}>
                {(hexInputMode || ansi256InputMode) ? (
                    // Static list when in input mode - no keyboard interaction
                    <Box flexDirection='column'>
                        {menuItems.map(item => (
                            <Text
                                key={item.value}
                                color={item.value === highlightedItemId ? 'cyan' : 'white'}
                                bold={item.value === highlightedItemId}
                            >
                                {item.value === highlightedItemId ? '▶ ' : '  '}
                                {item.label}
                            </Text>
                        ))}
                    </Box>
                ) : (
                    // Interactive SelectInput when not in input mode
                    <SelectInput
                        key={`${showSeparators}-${highlightedItemId}`}
                        items={menuItems}
                        onSelect={handleSelect}
                        onHighlight={handleHighlight}
                        initialIndex={Math.max(0, menuItems.findIndex(item => item.value === highlightedItemId))}
                        indicatorComponent={({ isSelected }) => (
                            <Text>{isSelected ? '▶' : '  '}</Text>
                        )}
                        itemComponent={({ isSelected, label }) => (
                            // The label already has ANSI codes applied via applyColors()
                            // We need to pass it directly as a single Text child to preserve the codes
                            <Text>{` ${label}`}</Text>
                        )}
                    />
                )}
            </Box>
            <Box marginTop={1} flexDirection='column'>
                <Text color='yellow'>⚠ VSCode 用户注意: </Text>
                <Text dimColor wrap='wrap'>如果 VSCode 集成终端中颜色显示不正确，可能是"Terminal › Integrated: Minimum Contrast Ratio"（`terminal.integrated.minimumContrastRatio`）设置强制了前景色和背景色之间的最低对比度。你可以将该设置调整为 1 来禁用对比度强制，或者使用独立终端以获得准确的颜色显示。</Text>
            </Box>
        </Box>
    );
};
