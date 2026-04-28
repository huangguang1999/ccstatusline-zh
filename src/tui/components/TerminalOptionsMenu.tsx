import chalk from 'chalk';
import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { Settings } from '../../types/Settings';
import {
    hasCustomWidgetColors,
    sanitizeLinesForColorLevel
} from '../../utils/color-sanitize';

import { ConfirmDialog } from './ConfirmDialog';
import {
    List,
    type ListEntry
} from './List';

type TerminalOptionsValue = 'width' | 'colorLevel';

export function getNextColorLevel(level: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
    return ((level + 1) % 4) as 0 | 1 | 2 | 3;
}

export function shouldWarnOnColorLevelChange(
    currentLevel: 0 | 1 | 2 | 3,
    nextLevel: 0 | 1 | 2 | 3,
    hasCustomColors: boolean
): boolean {
    return hasCustomColors
        && ((currentLevel === 2 && nextLevel !== 2)
            || (currentLevel === 3 && nextLevel !== 3));
}

export function buildTerminalOptionsItems(
    colorLevel: 0 | 1 | 2 | 3
): ListEntry<TerminalOptionsValue>[] {
    return [
        {
            label: '◱ 终端宽度',
            value: 'width',
            description: '配置状态栏如何使用可用的终端宽度以及何时应该压缩显示。'
        },
        {
            label: '▓ 颜色级别',
            sublabel: `(${getColorLevelLabel(colorLevel)})`,
            value: 'colorLevel',
            description: [
                '颜色级别影响颜色的渲染方式：',
                '• Truecolor：完整 24 位 RGB 颜色（1670 万色）',
                '• 256 色：扩展调色板（256 色）',
                '• Basic：标准 16 色终端调色板',
                '• 无颜色：禁用所有颜色输出'
            ].join('\n')
        }
    ];
}

export interface TerminalOptionsMenuProps {
    settings: Settings;
    onUpdate: (settings: Settings) => void;
    onBack: (target?: string) => void;
}

export const TerminalOptionsMenu: React.FC<TerminalOptionsMenuProps> = ({
    settings,
    onUpdate,
    onBack
}) => {
    const [showColorWarning, setShowColorWarning] = useState(false);
    const [pendingColorLevel, setPendingColorLevel] = useState<0 | 1 | 2 | 3 | null>(null);

    const handleSelect = (value: TerminalOptionsValue | 'back') => {
        if (value === 'back') {
            onBack();
            return;
        }

        if (value === 'width') {
            onBack('width');
            return;
        }

        const hasCustomColors = hasCustomWidgetColors(settings.lines);
        const currentLevel = settings.colorLevel;
        const nextLevel = getNextColorLevel(currentLevel);

        if (shouldWarnOnColorLevelChange(currentLevel, nextLevel, hasCustomColors)) {
            setShowColorWarning(true);
            setPendingColorLevel(nextLevel);
            return;
        }

        chalk.level = nextLevel;

        const cleanedLines = sanitizeLinesForColorLevel(settings.lines, nextLevel);

        onUpdate({
            ...settings,
            lines: cleanedLines,
            colorLevel: nextLevel
        });
    };

    const handleColorConfirm = () => {
        if (pendingColorLevel !== null) {
            chalk.level = pendingColorLevel;

            const cleanedLines = sanitizeLinesForColorLevel(settings.lines, pendingColorLevel);

            onUpdate({
                ...settings,
                lines: cleanedLines,
                colorLevel: pendingColorLevel
            });
        }
        setShowColorWarning(false);
        setPendingColorLevel(null);
    };

    const handleColorCancel = () => {
        setShowColorWarning(false);
        setPendingColorLevel(null);
    };

    useInput((_, key) => {
        if (key.escape && !showColorWarning) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>终端选项</Text>
            {showColorWarning ? (
                <Box flexDirection='column' marginTop={1}>
                    <Text color='yellow'>⚠ 警告：检测到自定义颜色！</Text>
                    <Text>切换颜色模式将会把自定义的 ansi256 或十六进制颜色重置为默认值。</Text>
                    <Box marginTop={1}>
                        <ConfirmDialog
                            message='继续？'
                            onConfirm={handleColorConfirm}
                            onCancel={handleColorCancel}
                            inline
                        />
                    </Box>
                </Box>
            ) : (
                <>
                    <Text color='white'>配置终端特定设置以获得最佳显示效果</Text>
                    <List
                        marginTop={1}
                        items={buildTerminalOptionsItems(settings.colorLevel)}
                        onSelect={handleSelect}
                        showBackButton={true}
                    />
                </>
            )}
        </Box>
    );
};

export const getColorLevelLabel = (level?: 0 | 1 | 2 | 3): string => {
    switch (level) {
        case 0: return '无颜色';
        case 1: return '基础';
        case 2:
        case undefined: return '256 色（默认）';
        case 3: return 'Truecolor';
        default: return '256 色（默认）';
    }
};
