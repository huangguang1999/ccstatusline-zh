import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { InstallationMetadata } from '../../types/Settings';
import {
    CCSTATUSLINE_COMMANDS,
    PINNED_INSTALL_COMMANDS,
    getClaudeSettingsPath,
    type PackageCommandAvailability,
    type StatusLineCommandMode
} from '../../utils/claude-settings';

import {
    List,
    type ListEntry
} from './List';

export type InstallUpdateStyle = 'auto-update' | 'pinned';
export type InstallPackageManager = 'npm' | 'bun';

export interface InstallSelection {
    updateStyle: InstallUpdateStyle;
    packageManager: InstallPackageManager;
    commandMode: StatusLineCommandMode;
    metadata: InstallationMetadata;
    displayedCommand: string;
    globalInstallCommand?: string;
}

export interface InstallMenuProps {
    commandAvailability: PackageCommandAvailability;
    currentVersion: string;
    existingStatusLine: string | null;
    onSelect: (selection: InstallSelection) => void;
    onCancel: () => void;
    initialPackageSelection?: number;
}

type InstallStep = 'style' | 'manager';

const AUTO_UPDATE_DESCRIPTION = '通过 npx/bunx 运行 `@latest`，自动跟随最新版本；每次启动会有少量包解析开销。如果你希望显式控制升级，可以改用「固定全局安装」。';

function getPinnedDescription(currentVersion: string): string {
    return `将 \`ccstatusline-zh@${currentVersion}\` 全局安装，Claude Code 直接调用 \`ccstatusline-zh\`，每次渲染更快，只有手动更新时才会变化。`;
}

function getStyleItems(currentVersion: string): ListEntry<InstallUpdateStyle>[] {
    return [
        {
            label: '自动更新',
            value: 'auto-update',
            description: AUTO_UPDATE_DESCRIPTION
        },
        {
            label: '固定全局安装',
            value: 'pinned',
            description: getPinnedDescription(currentVersion)
        }
    ];
}

function getManagerItems(
    updateStyle: InstallUpdateStyle,
    commandAvailability: PackageCommandAvailability,
    currentVersion: string
): ListEntry<InstallPackageManager>[] {
    if (updateStyle === 'auto-update') {
        return [
            {
                label: CCSTATUSLINE_COMMANDS.AUTO_NPX,
                value: 'npm',
                disabled: !commandAvailability.npx,
                sublabel: commandAvailability.npx ? undefined : '（未检测到 npx）'
            },
            {
                label: CCSTATUSLINE_COMMANDS.AUTO_BUNX,
                value: 'bun',
                disabled: !commandAvailability.bunx,
                sublabel: commandAvailability.bunx ? undefined : '（未检测到 bunx）'
            }
        ];
    }

    return [
        {
            label: PINNED_INSTALL_COMMANDS.NPM(currentVersion),
            value: 'npm',
            disabled: !commandAvailability.npm,
            sublabel: commandAvailability.npm ? undefined : '（未检测到 npm）'
        },
        {
            label: PINNED_INSTALL_COMMANDS.BUN(currentVersion),
            value: 'bun',
            disabled: !commandAvailability.bun,
            sublabel: commandAvailability.bun ? undefined : '（未检测到 bun）'
        }
    ];
}

function buildSelection(
    updateStyle: InstallUpdateStyle,
    packageManager: InstallPackageManager,
    currentVersion: string
): InstallSelection {
    if (updateStyle === 'auto-update') {
        return {
            updateStyle,
            packageManager,
            commandMode: packageManager === 'bun' ? 'auto-bunx' : 'auto-npx',
            displayedCommand: packageManager === 'bun'
                ? CCSTATUSLINE_COMMANDS.AUTO_BUNX
                : CCSTATUSLINE_COMMANDS.AUTO_NPX,
            metadata: {
                method: 'auto-update',
                packageManager
            }
        };
    }

    return {
        updateStyle,
        packageManager,
        commandMode: 'global',
        displayedCommand: packageManager === 'bun'
            ? PINNED_INSTALL_COMMANDS.BUN(currentVersion)
            : PINNED_INSTALL_COMMANDS.NPM(currentVersion),
        globalInstallCommand: packageManager === 'bun'
            ? PINNED_INSTALL_COMMANDS.BUN(currentVersion)
            : PINNED_INSTALL_COMMANDS.NPM(currentVersion),
        metadata: {
            method: 'pinned',
            installedVersion: currentVersion
        }
    };
}

export const InstallMenu: React.FC<InstallMenuProps> = ({
    commandAvailability,
    currentVersion,
    existingStatusLine,
    onSelect,
    onCancel,
    initialPackageSelection = 0
}) => {
    const [step, setStep] = useState<InstallStep>('style');
    const [updateStyle, setUpdateStyle] = useState<InstallUpdateStyle>('auto-update');

    useInput((_, key) => {
        if (key.escape) {
            if (step === 'manager') {
                setStep('style');
                return;
            }

            onCancel();
        }
    });

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

            {step === 'style' && (
                <>
                    <Box>
                        <Text dimColor>选择安装方式：</Text>
                    </Box>

                    <List
                        color='blue'
                        marginTop={1}
                        items={getStyleItems(currentVersion)}
                        onSelect={(value) => {
                            if (value === 'back') {
                                onCancel();
                                return;
                            }

                            setUpdateStyle(value);
                            setStep('manager');
                        }}
                        initialSelection={0}
                        showBackButton={true}
                    />
                </>
            )}

            {step === 'manager' && (
                <>
                    <Box>
                        <Text dimColor>选择包管理器：</Text>
                    </Box>

                    <List
                        color='blue'
                        marginTop={1}
                        items={getManagerItems(updateStyle, commandAvailability, currentVersion)}
                        onSelect={(value) => {
                            if (value === 'back') {
                                setStep('style');
                                return;
                            }

                            onSelect(buildSelection(updateStyle, value, currentVersion));
                        }}
                        initialSelection={initialPackageSelection}
                        showBackButton={true}
                    />
                </>
            )}

            <Box marginTop={2}>
                <Text dimColor>
                    所选命令将写入
                    {' '}
                    {getClaudeSettingsPath()}
                </Text>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>按 Enter 选择，ESC 返回</Text>
            </Box>
        </Box>
    );
};
