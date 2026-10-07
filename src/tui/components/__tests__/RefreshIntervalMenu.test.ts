import { render } from 'ink';
import { PassThrough } from 'node:stream';
import React from 'react';
import {
    describe,
    expect,
    it,
    vi
} from 'vitest';

import { waitFor } from '../../__tests__/helpers/wait-for-ink';
import {
    RefreshIntervalMenu,
    buildConfigureStatusLineItems,
    validateCustomCommandCacheTtlInput,
    validateGitCacheTtlInput,
    validateRefreshIntervalInput,
    validateTerminalWidthCacheTtlInput
} from '../RefreshIntervalMenu';

class MockTtyStream extends PassThrough {
    isTTY = true;
    columns = 120;
    rows = 40;

    setRawMode() {
        return this;
    }

    ref() {
        return this;
    }

    unref() {
        return this;
    }
}

interface CapturedWriteStream extends NodeJS.WriteStream {
    clearOutput: () => void;
    getOutput: () => string;
}

function createMockStdin(): NodeJS.ReadStream {
    return new MockTtyStream() as unknown as NodeJS.ReadStream;
}

function createMockStdout(): CapturedWriteStream {
    const stream = new MockTtyStream();
    const chunks: string[] = [];

    stream.on('data', (chunk: Buffer | string) => {
        chunks.push(chunk.toString());
    });

    return Object.assign(stream as unknown as NodeJS.WriteStream, {
        clearOutput() {
            chunks.length = 0;
        },
        getOutput() {
            return chunks.join('');
        }
    });
}

// Sends one key and waits for the redraw it causes to show the expected text
async function press(stdin: NodeJS.ReadStream, stdout: CapturedWriteStream, key: string, expected: string | RegExp): Promise<void> {
    stdout.clearOutput();
    stdin.write(key);
    await waitFor(() => {
        expect(stdout.getOutput()).toMatch(expected);
    });
}

// The menu row marker, the row's icon, then its label
function selected(label: string): RegExp {
    return new RegExp(`▶\\s+\\S+\\s+${label}`);
}

describe('validateRefreshIntervalInput', () => {
    it('should accept empty string (remove interval)', () => {
        expect(validateRefreshIntervalInput('')).toBeNull();
    });

    it('should accept valid values within range', () => {
        expect(validateRefreshIntervalInput('1')).toBeNull();
        expect(validateRefreshIntervalInput('10')).toBeNull();
        expect(validateRefreshIntervalInput('30')).toBeNull();
        expect(validateRefreshIntervalInput('60')).toBeNull();
    });

    it('should reject values below minimum', () => {
        expect(validateRefreshIntervalInput('0')).toContain('最小间隔');
    });

    it('should reject values above maximum', () => {
        expect(validateRefreshIntervalInput('61')).toContain('最大间隔');
    });

    it('should reject non-numeric input', () => {
        expect(validateRefreshIntervalInput('abc')).toContain('有效数字');
    });
});

describe('validateGitCacheTtlInput', () => {
    it('should accept valid values within range', () => {
        expect(validateGitCacheTtlInput('0')).toBeNull();
        expect(validateGitCacheTtlInput('5')).toBeNull();
        expect(validateGitCacheTtlInput('60')).toBeNull();
    });

    it('should reject values outside the range', () => {
        expect(validateGitCacheTtlInput('-1')).toContain('最小');
        expect(validateGitCacheTtlInput('61')).toContain('最大');
    });

    it('should reject empty and non-numeric input', () => {
        expect(validateGitCacheTtlInput('')).toContain('有效数字');
        expect(validateGitCacheTtlInput('abc')).toContain('有效数字');
    });
});

describe('validateCustomCommandCacheTtlInput', () => {
    it('should accept valid values within range', () => {
        expect(validateCustomCommandCacheTtlInput('0')).toBeNull();
        expect(validateCustomCommandCacheTtlInput('5')).toBeNull();
        expect(validateCustomCommandCacheTtlInput('60')).toBeNull();
    });

    it('should reject values outside the range', () => {
        expect(validateCustomCommandCacheTtlInput('-1')).toContain('最小');
        expect(validateCustomCommandCacheTtlInput('61')).toContain('最大');
    });

    it('should reject empty and non-numeric input', () => {
        expect(validateCustomCommandCacheTtlInput('')).toContain('有效数字');
        expect(validateCustomCommandCacheTtlInput('abc')).toContain('有效数字');
    });

    it('should name the field it rejects', () => {
        expect(validateCustomCommandCacheTtlInput('61')).toContain('自定义命令缓存时长');
    });
});

describe('buildConfigureStatusLineItems', () => {
    it('should show (not set) when interval is null and supported', () => {
        const items = buildConfigureStatusLineItems(null, true, 5, 5, 5);
        expect(items[0]?.sublabel).toBe('（未设置）');
    });

    it('should show seconds for set intervals', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 5, 5);
        expect(items[0]?.sublabel).toBe('（10 秒）');
    });

    it('should show seconds for small values', () => {
        const items = buildConfigureStatusLineItems(1, true, 5, 5, 5);
        expect(items[0]?.sublabel).toBe('（1 秒）');
    });

    it('should show version requirement when not supported', () => {
        const items = buildConfigureStatusLineItems(null, false, 5, 5, 5);
        expect(items[0]?.sublabel).toContain('需要 Claude Code');
        expect(items[0]?.disabled).toBe(true);
    });

    it('should not be disabled when supported', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 5, 5);
        expect(items[0]?.disabled).toBeFalsy();
    });

    it('should show the configured Git cache TTL', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 5, 5);
        expect(items[1]?.label).toContain('Git 缓存 TTL');
        expect(items[1]?.sublabel).toBe('（5 秒）');
    });

    it('should describe zero Git cache TTL as mtime-only', () => {
        const items = buildConfigureStatusLineItems(10, true, 0, 5, 5);
        expect(items[1]?.sublabel).toBe('（仅 mtime）');
    });

    it('should show the configured 自定义命令缓存时长', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 3, 5);
        expect(items[2]?.label).toContain('自定义命令缓存时长');
        expect(items[2]?.sublabel).toBe('（3 秒）');
    });

    it('should describe zero 自定义命令缓存时长 as disabled', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 0, 5);
        expect(items[2]?.sublabel).toBe('（已关闭）');
    });

    it('should show the configured Terminal Width cache TTL', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 5, 30);
        expect(items[3]?.label).toContain('终端宽度缓存时长');
        expect(items[3]?.sublabel).toBe('（30 秒）');
    });

    it('should describe zero Terminal Width cache TTL as disabled', () => {
        const items = buildConfigureStatusLineItems(10, true, 5, 5, 0);
        expect(items[3]?.sublabel).toBe('（已关闭）');
    });
});

describe('validateTerminalWidthCacheTtlInput', () => {
    it('should accept valid values within range', () => {
        expect(validateTerminalWidthCacheTtlInput('0')).toBeNull();
        expect(validateTerminalWidthCacheTtlInput('5')).toBeNull();
        expect(validateTerminalWidthCacheTtlInput('300')).toBeNull();
    });

    it('should reject values outside the range', () => {
        expect(validateTerminalWidthCacheTtlInput('-1')).toContain('最小');
        expect(validateTerminalWidthCacheTtlInput('301')).toContain('最大');
    });

    it('should reject empty and non-numeric input', () => {
        expect(validateTerminalWidthCacheTtlInput('')).toContain('有效数字');
        expect(validateTerminalWidthCacheTtlInput('abc')).toContain('有效数字');
    });
});

describe('RefreshIntervalMenu', () => {
    it('saves a three-digit Terminal Width cache TTL without changing the other settings', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onGitCacheTtlUpdate = vi.fn();
        const onCustomCommandCacheTtlUpdate = vi.fn();
        const onTerminalWidthCacheTtlUpdate = vi.fn();
        const instance = render(
            React.createElement(RefreshIntervalMenu, {
                currentInterval: 10,
                supportsRefreshInterval: true,
                gitCacheTtlSeconds: 5,
                customCommandCacheTtlSeconds: 0,
                terminalWidthCacheTtlSeconds: 5,
                onUpdate,
                onGitCacheTtlUpdate,
                onCustomCommandCacheTtlUpdate,
                onTerminalWidthCacheTtlUpdate,
                onBack: vi.fn()
            }),
            {
                stdin,
                stdout,
                stderr,
                debug: true,
                exitOnCtrlC: false,
                patchConsole: false
            }
        );

        try {
            await waitFor(() => {
                expect(stdout.getOutput()).toMatch(selected('刷新间隔'));
            });
            for (const label of ['Git 缓存 TTL', '自定义命令缓存时长', '终端宽度缓存时长']) {
                await press(stdin, stdout, '\u001B[B', selected(label));
            }
            await press(stdin, stdout, '\r', '输入终端宽度缓存时长（秒，0-300）:');
            expect(stdout.getOutput()).toContain('未检测到终端宽度');

            await press(stdin, stdout, '\u007F', '输入终端宽度缓存时长');
            await press(stdin, stdout, '300', '300');
            stdin.write('\r');
            await waitFor(() => {
                expect(onTerminalWidthCacheTtlUpdate).toHaveBeenCalledWith(300);
            });
            expect(onGitCacheTtlUpdate).not.toHaveBeenCalled();
            expect(onCustomCommandCacheTtlUpdate).not.toHaveBeenCalled();
            expect(onUpdate).not.toHaveBeenCalled();
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('keeps an unset interval empty when reopening the editor', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();
        const instance = render(
            React.createElement(RefreshIntervalMenu, {
                currentInterval: null,
                supportsRefreshInterval: true,
                gitCacheTtlSeconds: 5,
                customCommandCacheTtlSeconds: 5,
                terminalWidthCacheTtlSeconds: 5,
                onUpdate,
                onGitCacheTtlUpdate: vi.fn(),
                onCustomCommandCacheTtlUpdate: vi.fn(),
                onTerminalWidthCacheTtlUpdate: vi.fn(),
                onBack
            }),
            {
                stdin,
                stdout,
                stderr,
                debug: true,
                exitOnCtrlC: false,
                patchConsole: false
            }
        );

        try {
            await waitFor(() => {
                expect(stdout.getOutput()).toMatch(selected('刷新间隔'));
            });
            await press(stdin, stdout, '\r', '输入刷新间隔（秒，1-60）:');
            expect(stdout.getOutput()).not.toContain('10s');

            stdin.write('\r');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(null);
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('shows helper text while editing Git cache TTL and saves updates', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onGitCacheTtlUpdate = vi.fn();
        const onBack = vi.fn();
        const instance = render(
            React.createElement(RefreshIntervalMenu, {
                currentInterval: 10,
                supportsRefreshInterval: true,
                gitCacheTtlSeconds: 0,
                customCommandCacheTtlSeconds: 5,
                terminalWidthCacheTtlSeconds: 5,
                onUpdate,
                onGitCacheTtlUpdate,
                onCustomCommandCacheTtlUpdate: vi.fn(),
                onTerminalWidthCacheTtlUpdate: vi.fn(),
                onBack
            }),
            {
                stdin,
                stdout,
                stderr,
                debug: true,
                exitOnCtrlC: false,
                patchConsole: false
            }
        );

        try {
            await waitFor(() => {
                expect(stdout.getOutput()).toMatch(selected('刷新间隔'));
            });
            await press(stdin, stdout, '\u001B[B', selected('Git 缓存 TTL'));
            await press(stdin, stdout, '\r', '输入 Git 缓存 TTL（秒，0-60）:');
            expect(stdout.getOutput()).toContain('未暂存和未跟踪的工作区改动');

            stdin.write('\r');
            await waitFor(() => {
                expect(onGitCacheTtlUpdate).toHaveBeenCalledWith(0);
            });
            expect(onUpdate).not.toHaveBeenCalled();
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('edits the 自定义命令缓存时长 without touching the Git cache TTL', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onGitCacheTtlUpdate = vi.fn();
        const onCustomCommandCacheTtlUpdate = vi.fn();
        const instance = render(
            React.createElement(RefreshIntervalMenu, {
                currentInterval: 10,
                supportsRefreshInterval: true,
                gitCacheTtlSeconds: 5,
                customCommandCacheTtlSeconds: 0,
                terminalWidthCacheTtlSeconds: 5,
                onUpdate: vi.fn(),
                onGitCacheTtlUpdate,
                onCustomCommandCacheTtlUpdate,
                onTerminalWidthCacheTtlUpdate: vi.fn(),
                onBack: vi.fn()
            }),
            {
                stdin,
                stdout,
                stderr,
                debug: true,
                exitOnCtrlC: false,
                patchConsole: false
            }
        );

        try {
            await waitFor(() => {
                expect(stdout.getOutput()).toMatch(selected('刷新间隔'));
            });
            await press(stdin, stdout, '\u001B[B', selected('Git 缓存 TTL'));
            await press(stdin, stdout, '\u001B[B', selected('自定义命令缓存时长'));
            await press(stdin, stdout, '\r', '输入自定义命令缓存时长（秒，0-60）:');
            expect(stdout.getOutput()).toContain('启动 Shell 的频率');

            await press(stdin, stdout, '7', '输入自定义命令缓存时长');
            stdin.write('\r');
            await waitFor(() => {
                expect(onCustomCommandCacheTtlUpdate).toHaveBeenCalledWith(7);
            });
            expect(onGitCacheTtlUpdate).not.toHaveBeenCalled();
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });
});
