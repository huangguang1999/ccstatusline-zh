import {
    Box,
    Text
} from 'ink';
import React from 'react';

import type {
    InstallationMetadata,
    Settings
} from '../../types/Settings';
import { type PowerlineFontStatus } from '../../utils/powerline';

import { List } from './List';

export type MainMenuOption = 'lines'
    | 'colors'
    | 'powerline'
    | 'terminalConfig'
    | 'globalOverrides'
    | 'install'
    | 'manageInstallation'
    | 'checkUpdates'
    | 'configureStatusLine'
    | 'starGithub'
    | 'save'
    | 'exit';

export interface MainMenuProps {
    onSelect: (value: MainMenuOption, index: number) => void;
    isClaudeInstalled: boolean;
    hasChanges: boolean;
    initialSelection?: number;
    powerlineFontStatus: PowerlineFontStatus;
    settings: Settings | null;
    installation?: InstallationMetadata;
    previewIsTruncated?: boolean;
}

interface MainMenuItem {
    label: string;
    sublabel?: string;
    disabled?: boolean;
    value: MainMenuOption;
    description: string;
}

export type MainMenuEntry = MainMenuItem | '-';

function usesManageInstallation(installation?: InstallationMetadata): boolean {
    return installation?.method === 'pinned' || installation?.method === 'self-managed';
}

function getInstallationMenuItem(
    isClaudeInstalled: boolean,
    installation?: InstallationMetadata
): MainMenuItem {
    if (!isClaudeInstalled) {
        return {
            label: '📦 安装到 Claude Code',
            value: 'install',
            description: '将 ccstatusline-zh 添加到 Claude Code 设置以自动渲染状态栏'
        };
    }

    if (usesManageInstallation(installation)) {
        return {
            label: '🧰 管理安装',
            value: 'manageInstallation',
            description: '检查已固定的全局安装更新或从 Claude Code 卸载 ccstatusline-zh'
        };
    }

    return {
        label: '🔌 从 Claude Code 卸载',
        value: 'install',
        description: '从 Claude Code 设置中移除 ccstatusline-zh'
    };
}

export function buildMainMenuItems(
    isClaudeInstalled: boolean,
    hasChanges: boolean,
    installation?: InstallationMetadata
): MainMenuEntry[] {
    const menuItems: MainMenuEntry[] = [
        {
            label: '📝 编辑状态行',
            value: 'lines',
            description:
                '配置多行状态栏，添加模型信息、Git 状态、Token 用量等组件'
        },
        {
            label: '🎨 编辑颜色',
            value: 'colors',
            description:
                '为每个组件自定义前景色、背景色和加粗样式'
        },
        {
            label: '⚡ Powerline 设置',
            value: 'powerline',
            description:
                '安装 Powerline 字体以获得更美观的分隔符和符号'
        },
        '-',
        {
            label: '💻 终端选项',
            value: 'terminalConfig',
            description: '配置终端特定设置以获得最佳显示效果'
        },
        {
            label: '🌐 全局覆盖',
            value: 'globalOverrides',
            description:
                '设置适用于所有组件的全局内边距、分隔符和颜色覆盖'
        },
        {
            label: '🔧 配置状态行',
            sublabel: isClaudeInstalled ? undefined : '（请先安装）',
            disabled: !isClaudeInstalled,
            value: 'configureStatusLine',
            description: '配置 Claude Code 状态行设置（如刷新间隔）'
        },
        '-',
        getInstallationMenuItem(isClaudeInstalled, installation)
    ];

    if (hasChanges) {
        menuItems.push(
            '-',
            {
                label: '💾 保存并退出',
                value: 'save',
                description: '保存所有更改并退出配置工具'
            },
            {
                label: '❌ 不保存退出',
                value: 'exit',
                description: '放弃更改并退出'
            },
            '-',
            {
                label: '⭐ 喜欢 ccstatusline-zh？来 GitHub 给个 Star',
                value: 'starGithub',
                description: '在浏览器中打开 ccstatusline-zh GitHub 仓库以 Star 本项目'
            }
        );
    } else {
        menuItems.push(
            '-',
            {
                label: '🚪 退出',
                value: 'exit',
                description: '退出配置工具'
            },
            '-',
            {
                label: '⭐ 喜欢 ccstatusline-zh？来 GitHub 给个 Star',
                value: 'starGithub',
                description: '在浏览器中打开 ccstatusline-zh GitHub 仓库以 Star 本项目'
            }
        );
    }

    return menuItems;
}

export function getMainMenuSelectionIndex(items: MainMenuEntry[], option: MainMenuOption): number {
    let selectionIndex = 0;

    for (const item of items) {
        if (item === '-') {
            continue;
        }

        if (item.value === option) {
            return selectionIndex;
        }

        if (!item.disabled) {
            selectionIndex += 1;
        }
    }

    return 0;
}

export function getMainMenuInstallSelectionIndex(
    isClaudeInstalled: boolean,
    installation?: InstallationMetadata
): number {
    const option = isClaudeInstalled && usesManageInstallation(installation)
        ? 'manageInstallation'
        : 'install';

    return getMainMenuSelectionIndex(buildMainMenuItems(isClaudeInstalled, false, installation), option);
}

export const MainMenu: React.FC<MainMenuProps> = ({
    onSelect,
    isClaudeInstalled,
    hasChanges,
    initialSelection = 0,
    powerlineFontStatus,
    settings,
    installation,
    previewIsTruncated
}) => {
    const menuItems = buildMainMenuItems(isClaudeInstalled, hasChanges, installation);

    // Check if we should show the truncation warning
    const showTruncationWarning
        = previewIsTruncated && settings?.flexMode === 'full-minus-40';

    return (
        <Box flexDirection='column'>
            {showTruncationWarning && (
                <Box marginBottom={1}>
                    <Text color='yellow'>
                        ⚠ 部分行被截断，请查看 终端选项 → 终端宽度
                        了解详情
                    </Text>
                </Box>
            )}

            <Text bold>主菜单</Text>

            <List
                items={menuItems}
                marginTop={1}
                onSelect={(value, index) => {
                    if (value === 'back') {
                        return;
                    }

                    onSelect(value, index);
                }}
                initialSelection={initialSelection}
            />
        </Box>
    );
};
