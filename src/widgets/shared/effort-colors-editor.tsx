import {
    Box,
    Text,
    useInput,
    type Key
} from 'ink';
import React, { useState } from 'react';

import {
    getColorLevelString,
    type ColorLevelString
} from '../../types/ColorLevel';
import type {
    WidgetEditorProps,
    WidgetItem
} from '../../types/Widget';
import {
    applyColors,
    getAvailableColorsForUI,
    getColorAnsiCode,
    getColorDisplayName
} from '../../utils/colors';
import {
    getPlainInput,
    shouldInsertInput
} from '../../utils/input-guards';
import {
    KNOWN_THINKING_EFFORTS,
    type TranscriptThinkingEffort
} from '../../utils/jsonl-metadata';

import {
    THINKING_EFFORT_DEFAULT_COLOR,
    formatThinkingEffort,
    getBracketColorMode,
    getLevelColor,
    isLevelColorsEnabled,
    parseCustomColor,
    resetLevelColors,
    setBracketColorMode,
    setLevelColor,
    setLevelColorsEnabled
} from './effort-style';

export const EDIT_LEVEL_COLORS_ACTION = 'edit-level-colors';

type Row = TranscriptThinkingEffort | 'brackets';
const ROWS: Row[] = [...KNOWN_THINKING_EFFORTS, 'brackets'];
const NAMED_COLORS = getAvailableColorsForUI().map(color => color.value).filter(value => value !== '');

// Custom (hex/ansi256) colors aren't in the named list, so cycling from one
// starts at either end of it
function cycleNamedColor(current: string, direction: 1 | -1): string {
    const index = NAMED_COLORS.indexOf(current);
    if (index === -1) {
        return NAMED_COLORS[direction === 1 ? 0 : NAMED_COLORS.length - 1] ?? current;
    }
    return NAMED_COLORS[(index + direction + NAMED_COLORS.length) % NAMED_COLORS.length] ?? current;
}

// Custom colors are labeled the way Edit Colors labels them (ANSI n, #RRGGBB),
// except the default xhigh orange, which has no name among the 16 named colors
function getColorLabel(color: string): string {
    if (color === 'ansi256:208') {
        return '橙色';
    }
    if (color.startsWith('ansi256:')) {
        return `ANSI ${color.substring(8)}`;
    }
    if (color.startsWith('hex:')) {
        return `#${color.substring(4).toUpperCase()}`;
    }
    return getColorDisplayName(color);
}

// The colors the status line draws at the configured color level; at No Color
// (colorsDisabled) it draws none
interface EditorColors {
    colorLevel: ColorLevelString;
    colorsDisabled: boolean;
}

// What a row shows: the brackets' color mode, or the level's color drawn in it
function getRowValue(widget: WidgetItem, row: Row, colors: EditorColors): string {
    if (row === 'brackets') {
        return getBracketColorMode(widget) === 'effort' ? '跟随力度' : '组件颜色';
    }
    const color = getLevelColor(widget, row, colors.colorLevel);
    const label = getColorLabel(color);
    const code = colors.colorsDisabled ? '' : getColorAnsiCode(color, colors.colorLevel);
    return code ? `${code}${label}\x1b[39m` : label;
}

export const EffortColorsEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel, settings }) => {
    const [draft, setDraft] = useState(widget);
    const [selectedIndex, setSelectedIndex] = useState(0);
    // The sample shows the highlighted level, or the last one highlighted
    // while the cursor is on the brackets row
    const [sampleLevel, setSampleLevel] = useState<TranscriptThinkingEffort>(KNOWN_THINKING_EFFORTS[0]);
    const [customInput, setCustomInput] = useState<string | null>(null);
    const [customError, setCustomError] = useState(false);

    const selectedRow = ROWS[selectedIndex] ?? 'brackets';
    const enabled = isLevelColorsEnabled(draft);
    const baseColor = draft.color ?? THINKING_EFFORT_DEFAULT_COLOR;
    const colors: EditorColors = {
        colorLevel: getColorLevelString(settings?.colorLevel),
        colorsDisabled: settings?.colorLevel === 0
    };

    // Moves the cursor up (-1) or down (1), wrapping past either end
    const moveBy = (delta: 1 | -1) => {
        const index = (selectedIndex + delta + ROWS.length) % ROWS.length;
        setSelectedIndex(index);
        const row = ROWS[index];
        if (row && row !== 'brackets') {
            setSampleLevel(row);
        }
    };

    // The brackets row switches mode; a level row steps through the named colors
    const changeColor = (direction: 1 | -1) => {
        if (selectedRow === 'brackets') {
            setDraft(setBracketColorMode(draft, getBracketColorMode(draft) === 'effort' ? 'widget' : 'effort'));
            return;
        }
        const current = getLevelColor(draft, selectedRow, colors.colorLevel);
        setDraft(setLevelColor(draft, selectedRow, cycleNamedColor(current, direction)));
    };

    const closeCustomInput = () => {
        setCustomInput(null);
        setCustomError(false);
    };

    // Typing a custom color for the selected level
    const handleCustomInput = (text: string, input: string, key: Key) => {
        if (key.escape) {
            closeCustomInput();
        } else if (key.return) {
            const color = parseCustomColor(text);
            if (color && selectedRow !== 'brackets') {
                setDraft(setLevelColor(draft, selectedRow, color));
                closeCustomInput();
            } else {
                setCustomError(true);
            }
        } else if (key.backspace || key.delete) {
            setCustomInput(text.slice(0, -1));
        } else if (shouldInsertInput(input, key)) {
            setCustomInput(text + input);
            setCustomError(false);
        }
    };

    useInput((input, key) => {
        if (customInput !== null) {
            handleCustomInput(customInput, input, key);
            return;
        }

        const shortcut = getPlainInput(input, key);

        if (key.return) {
            onComplete(draft);
        } else if (key.escape) {
            onCancel();
        } else if (key.upArrow || key.downArrow) {
            moveBy(key.downArrow ? 1 : -1);
        } else if (key.leftArrow || key.rightArrow) {
            changeColor(key.rightArrow ? 1 : -1);
        } else if (shortcut === ' ') {
            setDraft(setLevelColorsEnabled(draft, !enabled));
        } else if (shortcut === 'x' && selectedRow !== 'brackets') {
            setCustomInput('');
            setCustomError(false);
        } else if (shortcut === 'd') {
            setDraft(resetLevelColors(draft));
        }
    });

    // Colored as the status line colors it: the widget color around the level's runs
    const sample = applyColors(
        formatThinkingEffort(draft, { text: sampleLevel, level: sampleLevel }, colors),
        baseColor,
        undefined,
        false,
        colors.colorLevel,
        undefined,
        true
    );

    return (
        <Box flexDirection='column'>
            <Text bold>思考力度：分级颜色</Text>
            <Text dimColor>↑↓ 选择，←→ 更改颜色，空格启用/关闭，(x)自定义颜色，(d)恢复默认，Enter 保存，ESC 取消</Text>
            <Box marginTop={1}>
                <Text>示例: </Text>
                <Text>{sample}</Text>
            </Box>
            <Box marginTop={1}>
                <Text>分级颜色: </Text>
                <Text color={enabled ? 'green' : 'red'}>{enabled ? '启用' : '关闭'}</Text>
                {!enabled && <Text dimColor>  （按空格启用；关闭时组件使用统一颜色）</Text>}
            </Box>
            {customInput !== null && (
                <Box marginTop={1} flexDirection='column'>
                    <Box>
                        <Text>{`${selectedRow} 的自定义颜色（#RRGGBB 或 0-255）: `}</Text>
                        <Text color='cyan'>{customInput}</Text>
                    </Box>
                    {customError && <Text color='red'>颜色无效。请输入 #RRGGBB 或 0 到 255 的数字。</Text>}
                </Box>
            )}
            <Box marginTop={1} flexDirection='column'>
                {ROWS.map((row, index) => {
                    const isSelected = index === selectedIndex;
                    const value = getRowValue(draft, row, colors);
                    return (
                        <Box key={row} flexDirection='row' flexWrap='nowrap'>
                            <Box width={3}>
                                <Text color={isSelected ? 'green' : undefined}>{isSelected ? '▶ ' : '  '}</Text>
                            </Box>
                            <Box width={11}>
                                <Text color={isSelected ? 'green' : undefined} dimColor={!enabled && !isSelected}>{row === 'brackets' ? '括号' : row}</Text>
                            </Box>
                            <Text dimColor={!enabled}>{value}</Text>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
