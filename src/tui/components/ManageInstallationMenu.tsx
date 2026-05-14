import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import type { ResolvedInstallationMetadata } from '../../types/Settings';
import type {
    ActiveGlobalCommandResolution,
    GlobalPackageInstallation,
    GlobalPackageManager
} from '../../utils/global-package-manager';

import {
    List,
    type ListEntry
} from './List';

export type ManageInstallationAction = 'checkUpdates' | 'uninstall';

export interface UninstallSelection { packageManagers: GlobalPackageManager[] }

export interface ManageInstallationMenuProps {
    installation: ResolvedInstallationMetadata;
    activeCommand: ActiveGlobalCommandResolution | null;
    onSelect: (action: ManageInstallationAction) => void;
    onBack: () => void;
}

export interface UninstallMenuProps {
    installations: GlobalPackageInstallation[];
    onSelect: (selection: UninstallSelection) => void;
    onBack: () => void;
}

function getInstallationLabel(installation: ResolvedInstallationMetadata): string {
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

    if (installation.method === 'auto-update') {
        return `通过 ${installation.packageManager} 自动更新`;
    }

    return '未知安装方式';
}

function getActiveCommandLabel(activeCommand: ActiveGlobalCommandResolution | null): string | null {
    if (!activeCommand?.resolvedPath) {
        return null;
    }

    if (activeCommand.packageManager === 'unknown') {
        return `当前 PATH 匹配：${activeCommand.resolvedPath}`;
    }

    const version = activeCommand.version
        ? ` ${activeCommand.version}`
        : '';

    return `当前 PATH 匹配：${activeCommand.packageManager} 全局${version}（${activeCommand.resolvedPath}）`;
}

export function buildManageInstallationItems(): ListEntry<ManageInstallationAction>[] {
    return [
        {
            label: '🔄 检查更新',
            value: 'checkUpdates',
            description: '查询 npm 上最新版本并更新固定全局安装的 ccstatusline-zh 包'
        },
        {
            label: '🔌 卸载',
            value: 'uninstall',
            description: '从 Claude Code 设置中移除 ccstatusline-zh，可选同时清理全局 npm/bun 包'
        }
    ];
}

function formatPackageManagers(packageManagers: GlobalPackageManager[]): string {
    return packageManagers.join(' + ');
}

export function buildUninstallItems(
    installations: GlobalPackageInstallation[]
): ListEntry<UninstallSelection>[] {
    const removableManagers = installations
        .filter(installation => installation.installed && installation.available)
        .map(installation => installation.packageManager);

    const items: ListEntry<UninstallSelection>[] = [
        {
            label: '仅从 Claude Code 设置中移除',
            value: { packageManagers: [] },
            description: '保留已安装的全局 npm / bun ccstatusline-zh 包'
        }
    ];

    for (const packageManager of removableManagers) {
        items.push({
            label: `移除 Claude 设置，并卸载 ${packageManager} 全局包`,
            value: { packageManagers: [packageManager] },
            description: `移除 Claude Code 设置后执行 ${packageManager === 'npm'
                ? 'npm uninstall -g ccstatusline-zh'
                : 'bun remove -g ccstatusline-zh'}`
        });
    }

    if (removableManagers.length > 1) {
        items.push({
            label: `移除 Claude 设置，并卸载 ${formatPackageManagers(removableManagers)} 全局包`,
            value: { packageManagers: removableManagers },
            description: '在移除 Claude Code 设置后，删除所有检测到的全局 ccstatusline-zh 包'
        });
    }

    return items;
}

export const ManageInstallationMenu: React.FC<ManageInstallationMenuProps> = ({
    installation,
    activeCommand,
    onSelect,
    onBack
}) => {
    const activeCommandLabel = getActiveCommandLabel(activeCommand);

    useInput((_, key) => {
        if (key.escape) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>Manage Installation</Text>
            <Box marginTop={1}>
                <Text>
                    当前:
                    {' '}
                    {getInstallationLabel(installation)}
                </Text>
            </Box>
            {activeCommandLabel && (
                <Box>
                    <Text dimColor>{activeCommandLabel}</Text>
                </Box>
            )}
            {activeCommand?.warning && (
                <Box marginTop={1}>
                    <Text color='yellow' wrap='wrap'>{activeCommand.warning}</Text>
                </Box>
            )}
            <List
                marginTop={1}
                items={buildManageInstallationItems()}
                onSelect={(value) => {
                    if (value === 'back') {
                        onBack();
                        return;
                    }

                    onSelect(value);
                }}
                showBackButton={true}
            />
        </Box>
    );
};

export const UninstallMenu: React.FC<UninstallMenuProps> = ({
    installations,
    onSelect,
    onBack
}) => {
    const items = buildUninstallItems(installations);
    const detectedManagers = installations
        .filter(installation => installation.installed && installation.available)
        .map(installation => installation.packageManager);

    useInput((_, key) => {
        if (key.escape) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>Uninstall ccstatusline</Text>
            <Box marginTop={1}>
                <Text dimColor>
                    请选择要从本机移除的内容。
                </Text>
            </Box>
            {detectedManagers.length === 0 && (
                <Box marginTop={1}>
                    <Text dimColor>未检测到全局 npm 或 bun ccstatusline-zh 包。</Text>
                </Box>
            )}
            <List
                marginTop={1}
                items={items}
                onSelect={(value) => {
                    if (value === 'back') {
                        onBack();
                        return;
                    }

                    onSelect(value);
                }}
                showBackButton={true}
            />
        </Box>
    );
};
