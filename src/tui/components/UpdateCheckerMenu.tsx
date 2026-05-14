import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import type {
    UpdateAction,
    UpdateCheckResult
} from '../../utils/update-checker';

import {
    List,
    type ListEntry
} from './List';

export type UpdateCheckerState = { status: 'checking' } | UpdateCheckResult;

export interface UpdateCheckerMenuProps {
    state: UpdateCheckerState;
    onBack: () => void;
    onRefresh: () => void;
    onRunAction: (action: UpdateAction) => void;
}

type UpdateMenuAction = UpdateAction | 'refresh';

function getInstallationLabel(result: UpdateCheckResult): string {
    const { installation } = result;
    if (installation.method === 'auto-update') {
        return `通过 ${installation.packageManager} 自动更新`;
    }

    if (installation.method === 'pinned') {
        const version = installation.installedVersion
            ? ` ${installation.installedVersion}`
            : '';
        const manager = installation.packageManager === 'unknown'
            ? ''
            : `，包管理器：${installation.packageManager}`;

        return `固定全局安装${manager}${version}`;
    }

    if (installation.method === 'self-managed') {
        return '自管理 / 全局安装';
    }

    return '未知或未安装';
}

function getActionLabel(action: UpdateAction): string {
    return `执行 ${action.command}`;
}

function getActionSublabel(action: UpdateAction): string | undefined {
    if (action.available) {
        return undefined;
    }

    return action.packageManager === 'npm'
        ? '（未检测到 npm）'
        : '（未检测到 bun）';
}

function getActionItems(actions: UpdateAction[]): ListEntry<UpdateMenuAction>[] {
    return [
        ...actions.map((action): ListEntry<UpdateMenuAction> => ({
            label: getActionLabel(action),
            value: action,
            disabled: !action.available,
            sublabel: getActionSublabel(action)
        })),
        {
            label: '重新检查',
            value: 'refresh'
        }
    ];
}

export const UpdateCheckerMenu: React.FC<UpdateCheckerMenuProps> = ({
    state,
    onBack,
    onRefresh,
    onRunAction
}) => {
    useInput((_, key) => {
        if (key.escape) {
            onBack();
        }
    });

    if (state.status === 'checking') {
        return (
            <Box flexDirection='column'>
                <Text bold>检查更新</Text>
                <Box marginTop={1}>
                    <Text dimColor>正在查询 npm 仓库...</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>检查更新</Text>

            <Box marginTop={1} flexDirection='column'>
                <Text>
                    当前版本：
                    {' '}
                    {state.currentVersion}
                </Text>
                {state.status !== 'registry-failure' && (
                    <Text>
                        最新版本：
                        {' '}
                        {state.latestVersion}
                    </Text>
                )}
                <Text>
                    安装方式：
                    {' '}
                    {getInstallationLabel(state)}
                </Text>
            </Box>

            {state.status === 'registry-failure' && (
                <>
                    <Box marginTop={1}>
                        <Text color='red'>
                            查询仓库失败：
                            {' '}
                            {state.errorMessage}
                        </Text>
                    </Box>
                    <List
                        marginTop={1}
                        items={[{ label: '重新检查', value: 'refresh' }]}
                        onSelect={(value) => {
                            if (value === 'back') {
                                onBack();
                                return;
                            }

                            onRefresh();
                        }}
                        showBackButton={true}
                    />
                </>
            )}

            {state.status === 'up-to-date' && (
                <>
                    <Box marginTop={1}>
                        <Text color='green'>ccstatusline-zh 已是最新版本。</Text>
                    </Box>
                    <List
                        marginTop={1}
                        items={[{ label: '重新检查', value: 'refresh' }]}
                        onSelect={(value) => {
                            if (value === 'back') {
                                onBack();
                                return;
                            }

                            onRefresh();
                        }}
                        showBackButton={true}
                    />
                </>
            )}

            {state.status === 'update-available' && (
                <>
                    <Box marginTop={1}>
                        <Text color='yellow'>检测到可用更新。</Text>
                    </Box>

                    {state.installation.method === 'auto-update' && (
                        <Box marginTop={1} flexDirection='column'>
                            <Text>无需手动修改 Claude 配置，因为已使用 @latest 自动跟随。</Text>
                            <Text>下次调用 @latest 时会自动解析到最新版本。</Text>
                            <Text>
                                启动新 TUI 的命令：
                                {' '}
                                {state.autoUpdateLaunchCommand}
                            </Text>
                        </Box>
                    )}

                    {state.actions.length > 0 && (
                        <List
                            marginTop={1}
                            items={getActionItems(state.actions)}
                            onSelect={(value) => {
                                if (value === 'back') {
                                    onBack();
                                    return;
                                }

                                if (value === 'refresh') {
                                    onRefresh();
                                    return;
                                }

                                onRunAction(value);
                            }}
                            showBackButton={true}
                        />
                    )}

                    {state.actions.length === 0 && (
                        <List
                            marginTop={1}
                            items={[{ label: '重新检查', value: 'refresh' }]}
                            onSelect={(value) => {
                                if (value === 'back') {
                                    onBack();
                                    return;
                                }

                                onRefresh();
                            }}
                            showBackButton={true}
                        />
                    )}
                </>
            )}
        </Box>
    );
};
