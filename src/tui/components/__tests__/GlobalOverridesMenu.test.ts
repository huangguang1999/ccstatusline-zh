import { render } from 'ink';
import { PassThrough } from 'node:stream';
import React from 'react';
import stripAnsi from 'strip-ansi';
import {
    afterEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import { DEFAULT_SETTINGS } from '../../../types/Settings';
import { getVisibleWidth } from '../../../utils/ansi';
import { waitFor } from '../../__tests__/helpers/wait-for-ink';
import { GlobalOverridesMenu } from '../GlobalOverridesMenu';

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

describe('GlobalOverridesMenu', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('displays minimalist mode as disabled by default', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: DEFAULT_SETTINGS,
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
                expect(stdout.getOutput()).toContain('✗ 已禁用');
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('right-aligns number kind labels on their colons', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: DEFAULT_SETTINGS,
                onUpdate: vi.fn(),
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdout.clearOutput();
            stdin.write('n');
            const numberRows = () => stripAnsi(stdout.getOutput())
                .split('\n')
                .filter(line => /(?:令牌|速度|占比|内存|费用): 固定小数（默认）/.test(line));
            await waitFor(() => {
                expect(numberRows()).toHaveLength(5);
            });

            const colonColumns = new Set(numberRows().map(line => getVisibleWidth(line.slice(0, line.indexOf(':')))));
            expect(colonColumns.size).toBe(1);
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('toggles minimalist mode on when (m) is pressed', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: { ...DEFAULT_SETTINGS, minimalistMode: false },
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdin.write('m');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ minimalistMode: true }));
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('toggles minimalist mode off when (m) is pressed while enabled', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: { ...DEFAULT_SETTINGS, minimalistMode: true },
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdin.write('m');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ minimalistMode: false }));
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('displays padding side as "两侧" by default', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: DEFAULT_SETTINGS,
                onUpdate,
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
                expect(stdout.getOutput()).toContain('内边距方向:');
                expect(stdout.getOutput()).toContain('两侧');
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it.each([
        { starting: 'both' as const, expected: 'left' as const },
        { starting: 'left' as const, expected: 'right' as const },
        { starting: 'right' as const, expected: 'both' as const }
    ])('cycles padding side from "$starting" to "$expected" when (d) is pressed', async ({ starting, expected }) => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: { ...DEFAULT_SETTINGS, defaultPaddingSide: starting },
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdin.write('d');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ defaultPaddingSide: expected }));
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('shows foreground override gradient and clear controls on the same line', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: DEFAULT_SETTINGS,
                onUpdate,
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
                expect(stdout.getOutput()).toContain('覆盖前景色:');
                expect(stdout.getOutput()).toContain('(f) 切换，(g) 渐变色，(x) 清除');
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('applies a foreground override gradient from the preset selector', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: { ...DEFAULT_SETTINGS, colorLevel: 3 },
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdin.write('g');
            await waitFor(() => {
                expect(stdout.getOutput()).toContain('选择渐变 - 覆盖前景色');
            });

            stdin.write('\r');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ overrideForegroundColor: 'gradient:atlas' }));
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });

    it('clears the foreground override when (x) is pressed', async () => {
        const stdin = createMockStdin();
        const stdout = createMockStdout();
        const stderr = createMockStdout();
        const onUpdate = vi.fn();
        const onBack = vi.fn();

        const instance = render(
            React.createElement(GlobalOverridesMenu, {
                settings: { ...DEFAULT_SETTINGS, overrideForegroundColor: 'gradient:atlas' },
                onUpdate,
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
                expect(stdout.getOutput()).toContain('极简模式:');
            });
            stdin.write('x');
            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ overrideForegroundColor: undefined }));
            });
        } finally {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    });
});
