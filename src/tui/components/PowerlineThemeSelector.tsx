import {
    Box,
    Text,
    useInput
} from 'ink';
import React, {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import { getColorLevelString } from '../../types/ColorLevel';
import type { Settings } from '../../types/Settings';
import {
    getPowerlineTheme,
    getPowerlineThemes
} from '../../utils/colors';

import { ConfirmDialog } from './ConfirmDialog';
import {
    List,
    type ListEntry
} from './List';

export function buildPowerlineThemeItems(
    themes: string[],
    originalTheme: string
): ListEntry<string>[] {
    return themes.map((themeName) => {
        const theme = getPowerlineTheme(themeName);

        return {
            label: theme?.name ?? themeName,
            sublabel: themeName === originalTheme ? '（当前）' : undefined,
            value: themeName,
            description: theme?.description ?? ''
        };
    });
}

export function applyCustomPowerlineTheme(
    settings: Settings,
    themeName: string
): Settings | null {
    const theme = getPowerlineTheme(themeName);

    if (!theme || themeName === 'custom') {
        return null;
    }

    const colorLevel = getColorLevelString(settings.colorLevel);
    const colorLevelKey = colorLevel === 'ansi16' ? '1' : colorLevel === 'ansi256' ? '2' : '3';
    const themeColors = theme[colorLevelKey];

    if (!themeColors) {
        return null;
    }

    const lines = settings.lines.map((line) => {
        let widgetColorIndex = 0;

        return line.map((widget) => {
            if (widget.type === 'separator' || widget.type === 'flex-separator') {
                return widget;
            }

            const fgColor = themeColors.fg[widgetColorIndex % themeColors.fg.length];
            const bgColor = themeColors.bg[widgetColorIndex % themeColors.bg.length];
            widgetColorIndex++;

            return {
                ...widget,
                color: fgColor,
                backgroundColor: bgColor
            };
        });
    });

    return {
        ...settings,
        powerline: {
            ...settings.powerline,
            theme: 'custom'
        },
        lines
    };
}

export interface PowerlineThemeSelectorProps {
    settings: Settings;
    onUpdate: (settings: Settings) => void;
    onBack: () => void;
}

export const PowerlineThemeSelector: React.FC<PowerlineThemeSelectorProps> = ({
    settings,
    onUpdate,
    onBack
}) => {
    const themes = useMemo(() => getPowerlineThemes(), []);
    const currentTheme = settings.powerline.theme ?? 'custom';
    const [selectedIndex, setSelectedIndex] = useState(Math.max(0, themes.indexOf(currentTheme)));
    const [showCustomizeConfirm, setShowCustomizeConfirm] = useState(false);
    const originalThemeRef = useRef(currentTheme);
    const originalSettingsRef = useRef(settings);
    const latestSettingsRef = useRef(settings);
    const latestOnUpdateRef = useRef(onUpdate);
    const didHandleInitialSelectionRef = useRef(false);

    useEffect(() => {
        latestSettingsRef.current = settings;
        latestOnUpdateRef.current = onUpdate;
    }, [settings, onUpdate]);

    useEffect(() => {
        const themeName = themes[selectedIndex];

        if (!themeName) {
            return;
        }

        if (!didHandleInitialSelectionRef.current) {
            didHandleInitialSelectionRef.current = true;
            return;
        }

        latestOnUpdateRef.current({
            ...latestSettingsRef.current,
            powerline: {
                ...latestSettingsRef.current.powerline,
                theme: themeName
            }
        });
    }, [selectedIndex, themes]);

    useInput((input, key) => {
        if (showCustomizeConfirm) {
            return;
        }

        if (key.escape) {
            onUpdate(originalSettingsRef.current);
            onBack();
        } else if (input === 'c' || input === 'C') {
            const currentThemeName = themes[selectedIndex];
            if (currentThemeName && currentThemeName !== 'custom') {
                setShowCustomizeConfirm(true);
            }
        }
    });

    const selectedThemeName = themes[selectedIndex];
    const themeItems = useMemo(
        () => buildPowerlineThemeItems(themes, originalThemeRef.current),
        [themes]
    );

    if (showCustomizeConfirm) {
        return (
            <Box flexDirection='column'>
                <Text bold color='yellow'>⚠ 确认自定义</Text>
                <Box marginTop={1} flexDirection='column'>
                    <Text>这将把当前主题颜色复制到你的组件中</Text>
                    <Text>并切换到自定义主题模式。</Text>
                    <Text color='red'>这将覆盖所有现有的自定义颜色！</Text>
                </Box>
                <Box marginTop={2}>
                    <Text>是否继续？</Text>
                </Box>
                <Box marginTop={1}>
                    <ConfirmDialog
                        inline={true}
                        onConfirm={() => {
                            if (selectedThemeName) {
                                const updatedSettings = applyCustomPowerlineTheme(settings, selectedThemeName);
                                if (updatedSettings) {
                                    onUpdate(updatedSettings);
                                }
                            }
                            setShowCustomizeConfirm(false);
                            onBack();
                        }}
                        onCancel={() => {
                            setShowCustomizeConfirm(false);
                        }}
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>
                {`Powerline 主题选择  |  `}
                <Text dimColor>
                    {`原始: ${originalThemeRef.current}`}
                </Text>
            </Text>
            <Box>
                <Text dimColor>
                    {`↑↓ 选择，Enter 应用${selectedThemeName && selectedThemeName !== 'custom' ? '，(c)自定义主题' : ''}，ESC 取消`}
                </Text>
            </Box>

            <List
                marginTop={1}
                items={themeItems}
                onSelect={() => {
                    onBack();
                }}
                onSelectionChange={(themeName, index) => {
                    if (themeName === 'back') {
                        return;
                    }

                    setSelectedIndex(index);
                }}
                initialSelection={selectedIndex}
            />

            {selectedThemeName && selectedThemeName !== 'custom' && (
                <Box marginTop={1}>
                    <Text dimColor>按 (c) 自定义此主题 - 将颜色复制到组件</Text>
                </Box>
            )}
            {settings.colorLevel === 1 && (
                <Box marginTop={1}>
                    <Text color='yellow'>⚠ 16 色模式的主题调色板非常有限，建议在终端选项中切换颜色级别</Text>
                </Box>
            )}
        </Box>
    );
};
