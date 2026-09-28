import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import { shouldInsertInput } from '../../utils/input-guards';

import {
    List,
    type ListEntry
} from './List';

type TtlField = 'gitCacheTtl' | 'customCommandCacheTtl' | 'terminalWidthCacheTtl';
type ConfigureStatusLineValue = 'refreshInterval' | TtlField;

function getRefreshInputValue(interval: number | null): string {
    return interval === null ? '' : String(interval);
}

function getRefreshIntervalSublabel(interval: number | null, supported: boolean): string {
    if (!supported) {
        return '（需要 Claude Code ≥ 2.1.97）';
    }

    if (interval === null) {
        return '（未设置）';
    }

    return `（${interval} 秒）`;
}

function getGitCacheTtlSublabel(ttlSeconds: number): string {
    return ttlSeconds === 0
        ? '（仅 mtime）'
        : `（${ttlSeconds} 秒）`;
}

function getCacheTtlSublabel(ttlSeconds: number): string {
    return ttlSeconds === 0
        ? '（已关闭）'
        : `（${ttlSeconds} 秒）`;
}

export function buildConfigureStatusLineItems(
    refreshInterval: number | null,
    supportsRefreshInterval: boolean,
    gitCacheTtlSeconds: number,
    customCommandCacheTtlSeconds: number,
    terminalWidthCacheTtlSeconds: number
): ListEntry<ConfigureStatusLineValue>[] {
    return [
        {
            label: '🔄 刷新间隔',
            sublabel: getRefreshIntervalSublabel(refreshInterval, supportsRefreshInterval),
            value: 'refreshInterval',
            disabled: !supportsRefreshInterval,
            description: supportsRefreshInterval
                ? 'Claude Code 重新运行状态栏命令的频率。输入秒数 (1-60)，留空即移除。'
                : '本设置需要 Claude Code 2.1.97 或更高版本。请升级 Claude Code 后再使用。'
        },
        {
            label: '🧮 Git 缓存 TTL',
            sublabel: getGitCacheTtlSublabel(gitCacheTtlSeconds),
            value: 'gitCacheTtl',
            description: 'Git 组件子进程输出在 .git/HEAD 与 .git/index 未变动期间可复用的时长。输入 0-60 秒；\n填 0 关闭按时长过期，缓存输出会一直复用，直到这些 Git 元数据的修改时间发生变化。'
        },
        {
            label: '🔧 自定义命令缓存时长',
            sublabel: getCacheTtlSublabel(customCommandCacheTtlSeconds),
            value: 'customCommandCacheTtl',
            description: '自定义命令输出在再次执行前可复用的时长。输入 0-60 秒；\n填 0 关闭缓存，每次渲染状态行都会执行命令。'
        },
        {
            label: '🖥️  终端宽度缓存时长',
            sublabel: getCacheTtlSublabel(terminalWidthCacheTtlSeconds),
            value: 'terminalWidthCacheTtl',
            description: '未检测到终端宽度时，等待多久再尝试检测。输入 0-300 秒；\n填 0 关闭缓存，每次都重新检测。已检测到的宽度会在下次渲染时重新检测。'
        }
    ];
}

export function validateRefreshIntervalInput(value: string): string | null {
    if (value === '') {
        return null;
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) {
        return '请输入有效数字';
    }

    if (parsed < 1) {
        return `最小间隔为 1 秒（输入了 ${parsed} 秒）`;
    }

    if (parsed > 60) {
        return `最大间隔为 60 秒（输入了 ${parsed} 秒）`;
    }

    return null;
}

function validateTtlInput(value: string, label: string, maximum = 60): string | null {
    const parsed = parseInt(value, 10);

    if (value === '' || isNaN(parsed)) {
        return '请输入有效数字';
    }

    if (parsed < 0) {
        return `${label}最小为 0 秒（输入了 ${parsed} 秒）`;
    }

    if (parsed > maximum) {
        return `${label}最大为 ${maximum} 秒（输入了 ${parsed} 秒）`;
    }

    return null;
}

export function validateGitCacheTtlInput(value: string): string | null {
    return validateTtlInput(value, 'Git 缓存 TTL');
}

export function validateCustomCommandCacheTtlInput(value: string): string | null {
    return validateTtlInput(value, '自定义命令缓存时长');
}

export function validateTerminalWidthCacheTtlInput(value: string): string | null {
    return validateTtlInput(value, '终端宽度缓存时长', 300);
}

interface TtlFieldConfig {
    currentValue: number;
    maxInputLength: number;
    prompt: string;
    helperText: string;
    hint: string;
    validate: (value: string) => string | null;
    onSave: (ttlSeconds: number) => void;
}

export interface RefreshIntervalMenuProps {
    currentInterval: number | null;
    supportsRefreshInterval: boolean;
    gitCacheTtlSeconds: number;
    customCommandCacheTtlSeconds: number;
    terminalWidthCacheTtlSeconds: number;
    onUpdate: (interval: number | null) => void;
    onGitCacheTtlUpdate: (ttlSeconds: number) => void;
    onCustomCommandCacheTtlUpdate: (ttlSeconds: number) => void;
    onTerminalWidthCacheTtlUpdate: (ttlSeconds: number) => void;
    onBack: () => void;
}

export const RefreshIntervalMenu: React.FC<RefreshIntervalMenuProps> = ({
    currentInterval,
    supportsRefreshInterval,
    gitCacheTtlSeconds,
    customCommandCacheTtlSeconds,
    terminalWidthCacheTtlSeconds,
    onUpdate,
    onGitCacheTtlUpdate,
    onCustomCommandCacheTtlUpdate,
    onTerminalWidthCacheTtlUpdate,
    onBack
}) => {
    const [editingRefreshInterval, setEditingRefreshInterval] = useState(false);
    const [editingTtlField, setEditingTtlField] = useState<TtlField | null>(null);
    const [refreshInput, setRefreshInput] = useState(() => getRefreshInputValue(currentInterval));
    const [ttlInput, setTtlInput] = useState(() => String(gitCacheTtlSeconds));
    const [validationError, setValidationError] = useState<string | null>(null);

    const ttlFields: Record<TtlField, TtlFieldConfig> = {
        gitCacheTtl: {
            currentValue: gitCacheTtlSeconds,
            maxInputLength: 2,
            prompt: '输入 Git 缓存 TTL（秒，0-60）:',
            helperText: '此设置影响 Git 组件多快能察觉到未暂存和未跟踪的工作区改动。',
            hint: '填 0 关闭按时长过期；缓存有效性仅依据 .git/HEAD 和 .git/index 的修改时间。',
            validate: validateGitCacheTtlInput,
            onSave: onGitCacheTtlUpdate
        },
        customCommandCacheTtl: {
            currentValue: customCommandCacheTtlSeconds,
            maxInputLength: 2,
            prompt: '输入自定义命令缓存时长（秒，0-60）:',
            helperText: '此设置影响自定义命令组件更新输出的速度，以及启动 Shell 的频率。',
            hint: '填 0 关闭缓存；每次渲染状态行都会重新执行命令。',
            validate: validateCustomCommandCacheTtlInput,
            onSave: onCustomCommandCacheTtlUpdate
        },
        terminalWidthCacheTtl: {
            currentValue: terminalWidthCacheTtlSeconds,
            maxInputLength: 3,
            prompt: '输入终端宽度缓存时长（秒，0-300）:',
            helperText: '控制未检测到终端宽度时的缓存时长。已检测到的宽度会在下次渲染时重新检测，使窗口大小变化立即生效。',
            hint: '填 0 关闭缓存，每次都重新检测。',
            validate: validateTerminalWidthCacheTtlInput,
            onSave: onTerminalWidthCacheTtlUpdate
        }
    };

    useInput((input, key) => {
        if (editingRefreshInterval) {
            if (key.return) {
                if (refreshInput === '') {
                    onUpdate(null);
                    setEditingRefreshInterval(false);
                    setValidationError(null);
                    return;
                }

                const error = validateRefreshIntervalInput(refreshInput);

                if (error) {
                    setValidationError(error);
                } else {
                    const value = parseInt(refreshInput, 10);
                    onUpdate(value);
                    setEditingRefreshInterval(false);
                    setValidationError(null);
                }
            } else if (key.escape) {
                setRefreshInput(getRefreshInputValue(currentInterval));
                setEditingRefreshInterval(false);
                setValidationError(null);
            } else if (key.backspace) {
                setRefreshInput(refreshInput.slice(0, -1));
                setValidationError(null);
            } else if (key.delete) {
                // No cursor position in simple input
            } else if (shouldInsertInput(input, key) && /\d/.test(input)) {
                const newValue = refreshInput + input;
                if (newValue.length <= 2) {
                    setRefreshInput(newValue);
                    setValidationError(null);
                }
            }
            return;
        }

        if (editingTtlField) {
            const field = ttlFields[editingTtlField];

            if (key.return) {
                const error = field.validate(ttlInput);

                if (error) {
                    setValidationError(error);
                } else {
                    const value = parseInt(ttlInput, 10);
                    field.onSave(value);
                    setEditingTtlField(null);
                    setValidationError(null);
                }
            } else if (key.escape) {
                setTtlInput(String(field.currentValue));
                setEditingTtlField(null);
                setValidationError(null);
            } else if (key.backspace) {
                setTtlInput(ttlInput.slice(0, -1));
                setValidationError(null);
            } else if (key.delete) {
                // No cursor position in simple input
            } else if (shouldInsertInput(input, key) && /\d/.test(input)) {
                const newValue = ttlInput + input;
                if (newValue.length <= field.maxInputLength) {
                    setTtlInput(newValue);
                    setValidationError(null);
                }
            }
            return;
        }

        if (key.escape) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>配置状态行</Text>
            <Text color='white'>配置 Claude Code 状态行设置</Text>

            {editingRefreshInterval ? (
                <Box marginTop={1} flexDirection='column'>
                    <Text>
                        输入刷新间隔（秒，1-60）:
                        {' '}
                        {refreshInput}
                        {refreshInput.length > 0 ? ' 秒' : ''}
                    </Text>
                    {validationError ? (
                        <Text color='red'>{validationError}</Text>
                    ) : (
                        <Text dimColor>按 Enter 确认，ESC 取消。留空即移除。</Text>
                    )}
                </Box>
            ) : editingTtlField ? (
                <Box marginTop={1} flexDirection='column'>
                    <Text>
                        {ttlFields[editingTtlField].prompt}
                        {' '}
                        {ttlInput}
                        {ttlInput.length > 0 ? ' 秒' : ''}
                    </Text>
                    <Text> </Text>
                    <Text dimColor wrap='wrap'>
                        {ttlFields[editingTtlField].helperText}
                    </Text>
                    {validationError ? (
                        <Text color='red'>{validationError}</Text>
                    ) : (
                        <Text dimColor>
                            {ttlFields[editingTtlField].hint}
                        </Text>
                    )}
                    <Text dimColor>按 Enter 确认，ESC 取消。</Text>
                </Box>
            ) : (
                <List
                    marginTop={1}
                    items={buildConfigureStatusLineItems(
                        currentInterval,
                        supportsRefreshInterval,
                        gitCacheTtlSeconds,
                        customCommandCacheTtlSeconds,
                        terminalWidthCacheTtlSeconds
                    )}
                    onSelect={(value) => {
                        if (value === 'back') {
                            onBack();
                            return;
                        }

                        if (value === 'refreshInterval') {
                            setRefreshInput(getRefreshInputValue(currentInterval));
                            setEditingRefreshInterval(true);
                            return;
                        }

                        setTtlInput(String(ttlFields[value].currentValue));
                        setEditingTtlField(value);
                    }}
                    showBackButton={true}
                />
            )}
        </Box>
    );
};
