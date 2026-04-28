import {
    Box,
    Text,
    useInput
} from 'ink';
import * as os from 'os';
import React, { useState } from 'react';

import type { PowerlineConfig } from '../../types/PowerlineConfig';
import type { Settings } from '../../types/Settings';
import { type PowerlineFontStatus } from '../../utils/powerline';
import { buildEnabledPowerlineSettings } from '../../utils/powerline-settings';

import { ConfirmDialog } from './ConfirmDialog';
import {
    List,
    type ListEntry
} from './List';
import { PowerlineSeparatorEditor } from './PowerlineSeparatorEditor';
import { PowerlineThemeSelector } from './PowerlineThemeSelector';

type PowerlineMenuValue = 'separator' | 'startCap' | 'endCap' | 'themes';
type Screen = 'menu' | PowerlineMenuValue;
function formatPowerlineMenuLabel(label: string): string {
    // 中文字符占 2 个终端宽度，计算实际显示宽度后用空格补齐
    const segmenter = new Intl.Segmenter();
    const displayWidth = Array.from(segmenter.segment(label)).reduce((w, { segment: ch }) => w + ((ch.codePointAt(0) ?? 0) > 0x7F ? 2 : 1), 0);
    const targetWidth = 10;
    const padCount = Math.max(0, targetWidth - displayWidth);
    return label + ' '.repeat(padCount);
}

export function getSeparatorDisplay(powerlineConfig: PowerlineConfig): string {
    const seps = powerlineConfig.separators;

    if (seps.length > 1) {
        return '多个';
    }

    const sep = seps[0] ?? '\uE0B0';
    const presets = [
        { char: '\uE0B0', name: '右三角' },
        { char: '\uE0B2', name: '左三角' },
        { char: '\uE0B4', name: '右圆弧' },
        { char: '\uE0B6', name: '左圆弧' }
    ];
    const preset = presets.find(item => item.char === sep);

    if (preset) {
        return preset.name;
    }

    return '自定义';
}

export function getCapDisplay(
    powerlineConfig: PowerlineConfig,
    type: 'start' | 'end'
): string {
    const caps = type === 'start'
        ? powerlineConfig.startCaps
        : powerlineConfig.endCaps;

    if (caps.length === 0) {
        return '无';
    }

    if (caps.length > 1) {
        return '多个';
    }

    const cap = caps[0];

    if (!cap) {
        return '无';
    }

    const presets = type === 'start' ? [
        { char: '\uE0B2', name: '三角' },
        { char: '\uE0B6', name: '圆弧' },
        { char: '\uE0BA', name: '下三角' },
        { char: '\uE0BE', name: '斜线' }
    ] : [
        { char: '\uE0B0', name: '三角' },
        { char: '\uE0B4', name: '圆弧' },
        { char: '\uE0B8', name: '下三角' },
        { char: '\uE0BC', name: '斜线' }
    ];
    const preset = presets.find(item => item.char === cap);

    if (preset) {
        return preset.name;
    }

    return '自定义';
}

export function getThemeDisplay(powerlineConfig: PowerlineConfig): string {
    const theme = powerlineConfig.theme;

    if (!theme || theme === 'custom') {
        return '自定义';
    }

    return theme.charAt(0).toUpperCase() + theme.slice(1);
}

export function buildPowerlineSetupMenuItems(
    powerlineConfig: PowerlineConfig
): ListEntry<PowerlineMenuValue>[] {
    const disabled = !powerlineConfig.enabled;

    return [
        {
            label: formatPowerlineMenuLabel('分隔符'),
            sublabel: `(${getSeparatorDisplay(powerlineConfig)})`,
            value: 'separator',
            disabled,
            description: '选择 Powerline 段之间使用的字形。'
        },
        {
            label: formatPowerlineMenuLabel('起始端帽'),
            sublabel: `(${getCapDisplay(powerlineConfig, 'start')})`,
            value: 'startCap',
            disabled,
            description: '配置每行 Powerline 起始位置显示的端帽字形。'
        },
        {
            label: formatPowerlineMenuLabel('结束端帽'),
            sublabel: `(${getCapDisplay(powerlineConfig, 'end')})`,
            value: 'endCap',
            disabled,
            description: '配置每行 Powerline 结束位置显示的端帽字形。'
        },
        {
            label: formatPowerlineMenuLabel('主题'),
            sublabel: `(${getThemeDisplay(powerlineConfig)})`,
            value: 'themes',
            disabled,
            description: '预览内置 Powerline 主题或将主题复制到自定义组件颜色中。'
        }
    ];
}

export interface PowerlineSetupProps {
    settings: Settings;
    powerlineFontStatus: PowerlineFontStatus;
    onUpdate: (settings: Settings) => void;
    onBack: () => void;
    onInstallFonts: () => void;
    installingFonts: boolean;
    fontInstallMessage: string | null;
    onClearMessage: () => void;
}

export const PowerlineSetup: React.FC<PowerlineSetupProps> = ({
    settings,
    powerlineFontStatus,
    onUpdate,
    onBack,
    onInstallFonts,
    installingFonts,
    fontInstallMessage,
    onClearMessage
}) => {
    const powerlineConfig = settings.powerline;
    const [screen, setScreen] = useState<Screen>('menu');
    const [selectedMenuItem, setSelectedMenuItem] = useState(0);
    const [confirmingEnable, setConfirmingEnable] = useState(false);
    const [confirmingFontInstall, setConfirmingFontInstall] = useState(false);

    const hasSeparatorItems = settings.lines.some(line => line.some(
        item => item.type === 'separator' || item.type === 'flex-separator'
    ));

    useInput((input, key) => {
        if (fontInstallMessage || installingFonts) {
            if (fontInstallMessage && !key.escape) {
                onClearMessage();
            }
            return;
        }

        if (confirmingFontInstall || confirmingEnable) {
            return;
        }

        if (screen === 'menu') {
            if (key.escape) {
                onBack();
            } else if (input === 't' || input === 'T') {
                if (!powerlineConfig.enabled) {
                    if (hasSeparatorItems) {
                        setConfirmingEnable(true);
                    } else {
                        onUpdate(buildEnabledPowerlineSettings(settings, false));
                    }
                } else {
                    onUpdate({
                        ...settings,
                        powerline: {
                            ...powerlineConfig,
                            enabled: false
                        }
                    });
                }
            } else if (input === 'i' || input === 'I') {
                setConfirmingFontInstall(true);
            } else if ((input === 'a' || input === 'A') && powerlineConfig.enabled) {
                onUpdate({
                    ...settings,
                    powerline: {
                        ...powerlineConfig,
                        autoAlign: !powerlineConfig.autoAlign
                    }
                });
            } else if ((input === 'c' || input === 'C') && powerlineConfig.enabled) {
                onUpdate({
                    ...settings,
                    powerline: {
                        ...powerlineConfig,
                        continueThemeAcrossLines: !powerlineConfig.continueThemeAcrossLines
                    }
                });
            }
        }
    });

    if (screen === 'separator') {
        return (
            <PowerlineSeparatorEditor
                settings={settings}
                mode='separator'
                onUpdate={onUpdate}
                onBack={() => { setScreen('menu'); }}
            />
        );
    }

    if (screen === 'startCap') {
        return (
            <PowerlineSeparatorEditor
                settings={settings}
                mode='startCap'
                onUpdate={onUpdate}
                onBack={() => { setScreen('menu'); }}
            />
        );
    }

    if (screen === 'endCap') {
        return (
            <PowerlineSeparatorEditor
                settings={settings}
                mode='endCap'
                onUpdate={onUpdate}
                onBack={() => { setScreen('menu'); }}
            />
        );
    }

    if (screen === 'themes') {
        return (
            <PowerlineThemeSelector
                settings={settings}
                onUpdate={onUpdate}
                onBack={() => { setScreen('menu'); }}
            />
        );
    }

    return (
        <Box flexDirection='column'>
            {!confirmingFontInstall && !installingFonts && !fontInstallMessage && (
                <Text bold>Powerline 设置</Text>
            )}

            {confirmingFontInstall ? (
                <Box flexDirection='column'>
                    <Box marginBottom={1}>
                        <Text color='cyan' bold>字体安装</Text>
                    </Box>

                    <Box marginBottom={1} flexDirection='column'>
                        <Text bold>将会执行：</Text>
                        <Text>
                            <Text dimColor>• 从以下地址克隆字体 </Text>
                            <Text color='blue'>https://github.com/powerline/fonts</Text>
                        </Text>
                        {os.platform() === 'darwin' && (
                            <>
                                <Text dimColor>• 运行 install.sh 脚本：</Text>
                                <Text dimColor>  - 复制所有 .ttf/.otf 文件到 ~/Library/Fonts</Text>
                                <Text dimColor>  - 在 macOS 中注册字体</Text>
                            </>
                        )}
                        {os.platform() === 'linux' && (
                            <>
                                <Text dimColor>• 运行 install.sh 脚本：</Text>
                                <Text dimColor>  - 复制所有 .ttf/.otf 文件到 ~/.local/share/fonts</Text>
                                <Text dimColor>  - 运行 fc-cache 更新字体缓存</Text>
                            </>
                        )}
                        {os.platform() === 'win32' && (
                            <>
                                <Text dimColor>• 复制 Powerline .ttf/.otf 文件到：</Text>
                                <Text dimColor>  AppData\Local\Microsoft\Windows\Fonts</Text>
                            </>
                        )}
                        <Text dimColor>• 清理临时文件</Text>
                    </Box>

                    <Box marginBottom={1}>
                        <Text color='yellow' bold>前提条件：</Text>
                        <Text dimColor>已安装 Git、网络连接、写入权限</Text>
                    </Box>

                    <Box marginBottom={1} flexDirection='column'>
                        <Text color='green' bold>安装后：</Text>
                        <Text dimColor>• 重启终端</Text>
                        <Text dimColor>• 选择一个 Powerline 字体</Text>
                        <Text dimColor>  （例如 "Meslo LG S for Powerline"）</Text>
                    </Box>

                    <Box marginTop={1}>
                        <Text>是否继续？</Text>
                    </Box>
                    <Box marginTop={1}>
                        <ConfirmDialog
                            inline={true}
                            onConfirm={() => {
                                setConfirmingFontInstall(false);
                                onInstallFonts();
                            }}
                            onCancel={() => {
                                setConfirmingFontInstall(false);
                            }}
                        />
                    </Box>
                </Box>
            ) : confirmingEnable ? (
                <Box flexDirection='column' marginTop={1}>
                    {hasSeparatorItems && (
                        <>
                            <Box>
                                <Text color='yellow'>⚠ 警告：启用 Powerline 模式将移除状态栏中所有现有的分隔符和弹性分隔符。</Text>
                            </Box>
                            <Box marginBottom={1}>
                                <Text dimColor>Powerline 模式使用自己的分隔符系统，与手动分隔符不兼容。</Text>
                            </Box>
                        </>
                    )}
                    <Box marginTop={hasSeparatorItems ? 1 : 0}>
                        <Text>是否要继续？</Text>
                    </Box>
                    <Box marginTop={1}>
                        <ConfirmDialog
                            inline={true}
                            onConfirm={() => {
                                onUpdate(buildEnabledPowerlineSettings(settings, true));
                                setConfirmingEnable(false);
                            }}
                            onCancel={() => {
                                setConfirmingEnable(false);
                            }}
                        />
                    </Box>
                </Box>
            ) : installingFonts ? (
                <Box>
                    <Text color='yellow'>正在安装 Powerline 字体... 这可能需要一些时间。</Text>
                </Box>
            ) : fontInstallMessage ? (
                <Box flexDirection='column'>
                    <Text color={fontInstallMessage.includes('success') ? 'green' : 'red'}>
                        {fontInstallMessage}
                    </Text>
                    <Box marginTop={1}>
                        <Text dimColor>按任意键继续...</Text>
                    </Box>
                </Box>
            ) : (
                <>
                    <Box flexDirection='column'>
                        <Text>
                            {'    字体状态：   '}
                            {powerlineFontStatus.installed ? (
                                <>
                                    <Text color='green'>✓ 已安装</Text>
                                    <Text dimColor> - 请确保终端中已激活字体</Text>
                                </>
                            ) : (
                                <>
                                    <Text color='yellow'>✗ 未安装</Text>
                                    <Text dimColor> - 按 (i) 安装 Powerline 字体</Text>
                                </>
                            )}
                        </Text>
                    </Box>

                    <Box>
                        <Text> Powerline 模式：</Text>
                        <Text color={powerlineConfig.enabled ? 'green' : 'red'}>
                            {powerlineConfig.enabled ? '✓ 已启用  ' : '✗ 已禁用  '}
                        </Text>
                        <Text dimColor> - 按 (t) 切换</Text>
                    </Box>

                    {powerlineConfig.enabled && (
                        <>
                            <Box>
                                <Text>    对齐组件：   </Text>
                                <Text color={powerlineConfig.autoAlign ? 'green' : 'red'}>
                                    {powerlineConfig.autoAlign ? '✓ 已启用  ' : '✗ 已禁用  '}
                                </Text>
                                <Text dimColor> - 按 (a) 切换</Text>
                            </Box>

                            <Box>
                                <Text> 主题色延续: </Text>
                                <Text color={powerlineConfig.continueThemeAcrossLines ? 'green' : 'red'}>
                                    {powerlineConfig.continueThemeAcrossLines ? '✓ 已启用  ' : '✗ 已禁用 '}
                                </Text>
                                <Text dimColor> - 按 (c) 切换</Text>
                            </Box>

                            <Box flexDirection='column' marginTop={1}>
                                <Text dimColor>
                                    启用后，全局覆盖将被禁用，并使用 Powerline 分隔符
                                </Text>
                                <Text dimColor>
                                    主题色延续：Powerline 颜色序列跨多行状态栏连续延续
                                </Text>
                            </Box>
                        </>
                    )}

                    {!powerlineConfig.enabled && (
                        <Box marginTop={1}>
                            <Text dimColor>启用 Powerline 模式以配置分隔符、端帽和主题。</Text>
                        </Box>
                    )}

                    <List
                        marginTop={1}
                        items={buildPowerlineSetupMenuItems(powerlineConfig)}
                        onSelect={(value) => {
                            if (value === 'back') {
                                onBack();
                                return;
                            }

                            setScreen(value);
                        }}
                        onSelectionChange={(_, index) => {
                            setSelectedMenuItem(index);
                        }}
                        initialSelection={selectedMenuItem}
                        showBackButton={true}
                    />
                </>
            )}
        </Box>
    );
};
