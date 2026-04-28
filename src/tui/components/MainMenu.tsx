import {
    Box,
    Text
} from 'ink';
import React from 'react';

import type { Settings } from '../../types/Settings';
import { type PowerlineFontStatus } from '../../utils/powerline';

import { List } from './List';

export type MainMenuOption = 'lines'
    | 'colors'
    | 'powerline'
    | 'terminalConfig'
    | 'globalOverrides'
    | 'install'
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
    previewIsTruncated?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
    onSelect,
    isClaudeInstalled,
    hasChanges,
    initialSelection = 0,
    powerlineFontStatus,
    settings,
    previewIsTruncated
}) => {
    // Build menu structure with visual gaps
    const menuItems: ({
        label: string;
        value: MainMenuOption;
        description: string;
    } | '-')[] = [
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
        '-' as const,
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
        '-' as const,
        ...(isClaudeInstalled
            ? [
                {
                    label: '🔧 配置状态行',
                    value: 'configureStatusLine' as MainMenuOption,
                    description: '配置 Claude Code 状态行设置（如刷新间隔）'
                },
                {
                    label: '🔌 从 Claude Code 卸载',
                    value: 'install' as MainMenuOption,
                    description: '从 Claude Code 设置中移除 ccstatusline-zh'
                }
            ]
            : [
                {
                    label: '📦 安装到 Claude Code',
                    value: 'install' as MainMenuOption,
                    description: '将 ccstatusline-zh 添加到 Claude Code 设置以自动渲染状态栏'
                }
            ]
        )
    ];

    if (hasChanges) {
        menuItems.push(
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
            '-' as const,
            {
                label: '⭐ 喜欢 ccstatusline-zh？来 GitHub 给个 Star',
                value: 'starGithub',
                description: '在浏览器中打开 ccstatusline-zh GitHub 仓库以 Star 本项目'
            }
        );
    } else {
        menuItems.push(
            {
                label: '🚪 退出',
                value: 'exit',
                description: '退出配置工具'
            },
            '-' as const,
            {
                label: '⭐ 喜欢 ccstatusline-zh？来 GitHub 给个 Star',
                value: 'starGithub',
                description: '在浏览器中打开 ccstatusline-zh GitHub 仓库以 Star 本项目'
            }
        );
    }

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
