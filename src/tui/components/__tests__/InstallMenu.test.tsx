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

interface CapturedWriteStream extends NodeJS.WriteStream { getOutput: () => string }

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
        getOutput() {
            return stripAnsi(chunks.join(''));
        }
    });
}

function flushInk() {
    return new Promise((resolve) => {
        setTimeout(resolve, 25);
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
            await flushInk();

            stdin.write('\u001B');
            await flushInk();

            expect(onCancel).toHaveBeenCalledTimes(1);
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
            await flushInk();

            const output = stdout.getOutput();
            expect(output).toContain('自动更新');
            expect(output).toContain('固定全局安装');
            expect(output.toLowerCase()).not.toContain('recommended');
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
            await flushInk();

            const output = stdout.getOutput();
            expect(output.indexOf('固定全局安装')).toBeLessThan(output.indexOf('自动更新'));
            expect(output).toContain('▶  固定全局安装');
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
            await flushInk();
            stdin.write('\r');
            await flushInk();

            const output = stdout.getOutput();
            expect(output).toContain('npm install -g ccstatusline-zh@2.2.13');
            expect(output).not.toContain('（未检测到 npm）');
            expect(output).toContain('bun add -g ccstatusline-zh@2.2.13');
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
            await flushInk();
            stdin.write('\r');
            await flushInk();
            expect(stdout.getOutput()).toContain('选择包管理器');

            stdin.write('\u001B');
            await flushInk();

            expect(onCancel).not.toHaveBeenCalled();
            expect(stdout.getOutput()).toContain('选择安装方式');
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });
});
