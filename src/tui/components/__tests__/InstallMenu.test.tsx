import { render } from 'ink';
import { PassThrough } from 'node:stream';
import React from 'react';
import stripAnsi from 'strip-ansi';
import {
    describe,
    expect,
    it,
    vi
} from 'vitest';

import { waitFor } from '../../__tests__/helpers/wait-for-ink';
import { InstallMenu } from '../InstallMenu';

const ALL_AVAILABLE = {
    npm: true,
    npx: true,
    bun: true,
    bunx: true
};

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
            return stripAnsi(chunks.join(''));
        }
    });
}

describe('InstallMenu', () => {
    it('calls onCancel when escape is pressed', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onCancel = vi.fn();
        const instance = render(
            React.createElement(InstallMenu, {
                commandAvailability: ALL_AVAILABLE,
                currentVersion: '2.2.13',
                existingStatusLine: null,
                onSelect: vi.fn(),
                onCancel
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
                expect(stdout.getOutput()).toContain('选择安装方式');
            });

            stdin.write('\u001B');
            await waitFor(() => {
                expect(onCancel).toHaveBeenCalledTimes(1);
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('renders both update styles without a recommendation label', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const instance = render(
            React.createElement(InstallMenu, {
                commandAvailability: ALL_AVAILABLE,
                currentVersion: '2.2.13',
                existingStatusLine: null,
                onSelect: vi.fn(),
                onCancel: vi.fn()
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
                expect(stdout.getOutput()).toContain('自动更新');
                expect(stdout.getOutput()).toContain('固定全局安装');
            });

            expect(stdout.getOutput().toLowerCase()).not.toContain('recommended');
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('shows pinned global install first and selected by default', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const instance = render(
            React.createElement(InstallMenu, {
                commandAvailability: ALL_AVAILABLE,
                currentVersion: '2.2.13',
                existingStatusLine: null,
                onSelect: vi.fn(),
                onCancel: vi.fn()
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
                expect(stdout.getOutput()).toContain('▶  固定全局安装');
                expect(stdout.getOutput()).toContain('自动更新');
            });

            const output = stdout.getOutput();
            expect(output.indexOf('固定全局安装')).toBeLessThan(output.indexOf('自动更新'));
            expect(output).not.toContain('▶  自动更新');
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('shows unavailable package managers as disabled in step two', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const instance = render(
            React.createElement(InstallMenu, {
                commandAvailability: {
                    npm: true,
                    npx: false,
                    bun: true,
                    bunx: false
                },
                currentVersion: '2.2.13',
                existingStatusLine: null,
                onSelect: vi.fn(),
                onCancel: vi.fn()
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
                expect(stdout.getOutput()).toContain('选择安装方式');
            });
            stdin.write('\r');
            await waitFor(() => {
                expect(stdout.getOutput()).toContain('npm install -g ccstatusline-zh@2.2.13');
                expect(stdout.getOutput()).toContain('bun add -g ccstatusline-zh@2.2.13');
            });

            const output = stdout.getOutput();
            expect(output).not.toContain('（未检测到 npm）');
            expect(output).not.toContain('（未检测到 bun）');
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('returns from package manager selection to update style on escape', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onCancel = vi.fn();
        const instance = render(
            React.createElement(InstallMenu, {
                commandAvailability: ALL_AVAILABLE,
                currentVersion: '2.2.13',
                existingStatusLine: null,
                onSelect: vi.fn(),
                onCancel
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
                expect(stdout.getOutput()).toContain('选择安装方式');
            });
            stdin.write('\r');
            await waitFor(() => {
                expect(stdout.getOutput()).toContain('选择包管理器');
            });

            stdout.clearOutput();
            stdin.write('\u001B');
            await waitFor(() => {
                expect(stdout.getOutput()).toContain('选择安装方式');
            });

            expect(onCancel).not.toHaveBeenCalled();
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });
});
